import type { ParamSpec, Placement, Step, TemplateParams, ValidationIssue, Vec3 } from '../types.ts';
import type { PaintFinish, ToolId, Tube, WeldProcess, WeldSettings } from './catalog.ts';

/** One cut length of tube. Mitered ends are measured long point to long point. */
export interface Member {
  id: string; // 'leg', 'top-long'
  label: string; // Spanish
  length: number; // mm
  ends: 'square' | 'miter'; // 90° or 45° at both ends
  qty: number;
}

/** What the 3D tool demo does: a tool tip travelling from → to, in assembly space (mm). */
export interface ToolAction {
  kind: 'cut' | 'grind' | 'tack' | 'weld' | 'measure' | 'paint';
  from: Vec3;
  to: Vec3;
  normal: Vec3; // unit vector: a cut disc faces along the tube's axis; every other tool faces out of the worked face
}

/** A build step; panelRefs name Member ids so the shared 3D viewer highlights them. */
export interface WeldStep extends Step {
  tools: ToolId[];
  action?: ToolAction;
}

export interface Suggestion {
  level: 'warn' | 'tip';
  message: string; // Spanish
  fix?: { label: string; params: TemplateParams }; // one-click param change, Spanish label
}

export interface WeldDesign {
  templateId: string;
  params: TemplateParams;
  tube: Tube; // every member is cut from this tube
  process: WeldProcess;
  finish: PaintFinish;
  settings: WeldSettings;
  members: Member[];
  placements: Placement[]; // panelId = Member.id
  joints: number; // tube-to-tube joints, each welded all round
  weldLength: number; // mm of bead
  weight: number; // kg of tube in the finished piece
  steps: WeldStep[];
  tools: ToolId[]; // every tool any step uses, first use first
  suggestions: Suggestion[];
}

export type WeldResult = { ok: true; design: WeldDesign } | { ok: false; issues: ValidationIssue[] };

export interface WeldTemplate {
  id: string;
  name: string; // Spanish
  description: string;
  params: ParamSpec[];
  generate: (params: TemplateParams) => WeldResult; // pure
}
