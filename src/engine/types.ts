// Core data model. All dimensions in millimeters.
// This module (and everything under src/engine/) must stay pure TypeScript:
// no React, DOM, or three.js imports — it ships to React Native unchanged.

/**
 * A board the planner can cut: one material at one thickness, sold in one sheet
 * size. The catalog lives in stock.ts.
 */
export interface Stock {
  id: number; // stable; a template's numeric "material" param stores it
  label: string; // Spanish display name, e.g. 'Triplay de pino 18 mm'
  thickness: number; // mm
  hasGrain: boolean; // false → nesting may rotate any panel
  sheet: { length: number; width: number }; // mm; grain runs along length
  maxSpan: number | null; // max unsupported shelf span, mm; null = never a shelf
}

export type PlywoodThickness = 12 | 15 | 18;

/**
 * Grain constraint. Sheet grain runs along the sheet's long (2440mm) axis.
 * 'length' → panel's length dim must lie along sheet grain.
 * 'width'  → panel's width dim must lie along sheet grain.
 * 'any'    → nesting may rotate freely.
 */
export type Grain = 'length' | 'width' | 'any';

export interface Panel {
  id: string; // stable slug, e.g. 'side-left'
  label: string; // display text, Spanish: 'Lateral izquierdo'
  length: number; // cut rectangle, long dim
  width: number;
  thickness: PlywoodThickness;
  grain: Grain;
  qty: number;
}

export interface Hardware {
  type: 'screw' | 'dowel' | 'confirmat';
  size: string; // '4x40', '5x50'
  qty: number;
}

export type Vec3 = [number, number, number]; // mm, x/y/z

/**
 * One physical panel instance in the assembled model, as an axis-aligned box.
 * Assembly space: x = width (left-right), y = height (up), z = depth. Floor at y=0.
 */
export interface Placement {
  panelId: string;
  instance: number; // 0..qty-1
  position: Vec3; // box center
  size: Vec3; // world-oriented dims (permutation of length/width/thickness)
}

export interface Step {
  order: number;
  title: string; // Spanish
  description: string; // Spanish
  panelRefs: string[]; // Panel.id[]
  explodeOffsets?: Record<string, Vec3>; // panelId → offset for exploded highlight
}

export interface Design {
  templateId: string;
  params: TemplateParams;
  panels: Panel[];
  placements: Placement[]; // Σ qty entries
  hardware: Hardware[];
  steps: Step[];
}

// ---- Templates ----

export type TemplateParams = Record<string, number>; // all params numeric

export type ParamSpec =
  | {
      kind: 'number';
      key: string;
      label: string;
      unit: 'mm' | '';
      min: number;
      max: number;
      step: number;
      default: number;
    }
  | {
      kind: 'select';
      key: string;
      label: string;
      unit: 'mm' | '';
      options: number[];
      default: number;
    };

export interface ValidationIssue {
  paramKey?: string; // undefined → cross-param issue
  message: string; // Spanish, human-readable
}

export type GenerateResult =
  | { ok: true; design: Design }
  | { ok: false; issues: ValidationIssue[] };

export interface Template {
  id: string;
  name: string; // Spanish
  description: string; // Spanish
  params: ParamSpec[];
  generate: (params: TemplateParams) => GenerateResult; // pure
}

// ---- Nesting ----

export interface NestingConfig {
  sheetLength: number; // 2440, grain along this axis
  sheetWidth: number; // 1220
  kerf: number; // 3, between adjacent pieces (not at sheet edges)
}

/** Sheet coords: origin top-left, x along width (0–1220), y along length (0–2440). */
export interface PlacedPiece {
  panelId: string;
  instance: number;
  x: number;
  y: number;
  length: number; // as placed, along sheet length axis
  width: number; // as placed, along sheet width axis
  rotated: boolean; // true → panel length lies along sheet width
}

export interface SheetLayout {
  thickness: PlywoodThickness; // one thickness per physical sheet
  pieces: PlacedPiece[];
}

export interface NestingResult {
  sheets: SheetLayout[]; // total sheets = sheets.length
  wastePercent: number; // 0–100, kerf counts as waste
}

// ---- Config ----

export interface EngineConfig {
  spanLimits: Record<PlywoodThickness, number>; // max unsupported span
  nesting: NestingConfig;
}

export const DEFAULT_CONFIG: EngineConfig = {
  spanLimits: { 12: 500, 15: 650, 18: 800 },
  nesting: { sheetLength: 2440, sheetWidth: 1220, kerf: 3 },
};
