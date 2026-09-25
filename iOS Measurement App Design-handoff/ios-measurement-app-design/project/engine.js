/* Port of src/engine/* from angelarroyod/plywood-planner (TS -> browser JS).
   Pure logic, no DOM. Exposed as window.PlyEngine. */
(function () {
  const DEFAULT_CONFIG = {
    spanLimits: { 12: 500, 15: 650, 18: 800 },
    nesting: { sheetLength: 2440, sheetWidth: 1220, kerf: 3 },
  };

  const HARDWARE_LABELS = {
    confirmat: 'Tornillo confirmat',
    screw: 'Tornillo',
    dowel: 'Taquete',
  };

  // ---- validation.ts ----
  function resolveParams(specs, params) {
    const out = {};
    for (const spec of specs) out[spec.key] = params[spec.key] ?? spec.default;
    return out;
  }

  function paramIssues(specs, params) {
    const issues = [];
    for (const spec of specs) {
      const value = params[spec.key] ?? spec.default;
      const unit = spec.unit ? ` ${spec.unit}` : '';
      if (spec.kind === 'number') {
        if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
          issues.push({
            paramKey: spec.key,
            message: `«${spec.label}» debe estar entre ${spec.min} y ${spec.max}${unit}.`,
          });
        }
      } else if (!spec.options.includes(value)) {
        issues.push({
          paramKey: spec.key,
          message: `«${spec.label}» debe ser uno de: ${spec.options.join(', ')}${unit}.`,
        });
      }
    }
    return issues;
  }

  function spanIssue(span, thickness, config) {
    const max = config.spanLimits[thickness];
    if (span <= max) return null;
    return {
      message:
        `El claro de ${span} mm supera el máximo seguro de ${max} mm ` +
        `para triplay de ${thickness} mm. Reduce el ancho o usa triplay más grueso.`,
    };
  }

  // ---- templates/bookshelf.ts ----
  const MIN_SHELF_GAP = 100;
  const bookshelfParams = [
    { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 1200, step: 10, default: 800 },
    { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 400, max: 2000, step: 10, default: 1200 },
    { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 200, max: 400, step: 10, default: 300 },
    { kind: 'number', key: 'shelfCount', label: 'Número de entrepaños', unit: '', min: 1, max: 8, step: 1, default: 3 },
    { kind: 'select', key: 'thickness', label: 'Grosor del triplay', unit: 'mm', options: [12, 15, 18], default: 18 },
  ];

  function generateBookshelf(raw, config = DEFAULT_CONFIG) {
    const p = resolveParams(bookshelfParams, raw);
    const rangeIssues = paramIssues(bookshelfParams, p);
    if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

    const W = p.width, H = p.height, D = p.depth, N = p.shelfCount, t = p.thickness;
    const issues = [];
    const span = W - 2 * t;
    const spanProblem = spanIssue(span, t, config);
    if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });

    const freeHeight = H - 2 * t - N * t;
    const gap = freeHeight / (N + 1);
    if (gap < MIN_SHELF_GAP) {
      issues.push({
        paramKey: 'shelfCount',
        message:
          `No caben ${N} entrepaños en ${H} mm de alto: quedarían espacios de ` +
          `${Math.max(0, Math.round(gap))} mm y el mínimo útil es ${MIN_SHELF_GAP} mm. ` +
          `Reduce los entrepaños o aumenta el alto.`,
      });
    }
    if (issues.length > 0) return { ok: false, issues };

    const panels = [
      { id: 'side', label: 'Lateral', length: H, width: D, thickness: t, grain: 'length', qty: 2 },
      { id: 'top', label: 'Tapa', length: span, width: D, thickness: t, grain: 'length', qty: 1 },
      { id: 'bottom', label: 'Base', length: span, width: D, thickness: t, grain: 'length', qty: 1 },
      { id: 'shelf', label: 'Entrepaño', length: span, width: D, thickness: t, grain: 'length', qty: N },
    ];

    const placements = [
      { panelId: 'side', instance: 0, position: [-(W - t) / 2, H / 2, 0], size: [t, H, D] },
      { panelId: 'side', instance: 1, position: [(W - t) / 2, H / 2, 0], size: [t, H, D] },
      { panelId: 'bottom', instance: 0, position: [0, t / 2, 0], size: [span, t, D] },
      { panelId: 'top', instance: 0, position: [0, H - t / 2, 0], size: [span, t, D] },
    ];
    for (let i = 1; i <= N; i++) {
      const y = t + i * gap + (i - 1) * t + t / 2;
      placements.push({ panelId: 'shelf', instance: i - 1, position: [0, y, 0], size: [span, t, D] });
    }

    const steps = [
      {
        order: 1,
        title: 'Prepara y marca',
        description: `Lija todas las piezas y marca en los laterales la posición de la base, la tapa y los ${N} entrepaños.`,
        panelRefs: ['side'],
      },
      {
        order: 2,
        title: 'Une la base y la tapa',
        description: 'Fija la base y la tapa entre los dos laterales con tornillos confirmat, 2 por lado.',
        panelRefs: ['side', 'top', 'bottom'],
        explodeOffsets: { top: [0, 150, 0], bottom: [0, -150, 0] },
      },
      {
        order: 3,
        title: 'Instala los entrepaños',
        description: 'Coloca cada entrepaño en su marca y fíjalo con 2 confirmat por lado.',
        panelRefs: ['shelf'],
        explodeOffsets: { shelf: [0, 0, 200] },
      },
      {
        order: 4,
        title: 'Verifica la escuadra',
        description: 'Mide las dos diagonales del frente: deben ser iguales. Ajusta antes de apretar del todo.',
        panelRefs: [],
      },
    ];

    return {
      ok: true,
      design: {
        templateId: 'bookshelf',
        params: p,
        panels,
        placements,
        hardware: [{ type: 'confirmat', size: '5x50', qty: (N + 2) * 4 }],
        steps,
      },
    };
  }

  // ---- templates/side-table.ts ----
  const SHELF_CLEARANCE = 100;
  const sideTableParams = [
    { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 800, step: 10, default: 500 },
    { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 250, max: 500, step: 10, default: 350 },
    { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 300, max: 900, step: 10, default: 450 },
    { kind: 'select', key: 'thickness', label: 'Grosor del triplay', unit: 'mm', options: [12, 15, 18], default: 18 },
  ];

  function generateSideTable(raw, config = DEFAULT_CONFIG) {
    const p = resolveParams(sideTableParams, raw);
    const rangeIssues = paramIssues(sideTableParams, p);
    if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

    const W = p.width, D = p.depth, H = p.height, t = p.thickness;
    const issues = [];
    const span = W - 2 * t;
    const spanProblem = spanIssue(span, t, config);
    if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
    if (issues.length > 0) return { ok: false, issues };

    const sideHeight = H - t;
    const panels = [
      { id: 'top', label: 'Cubierta', length: W, width: D, thickness: t, grain: 'length', qty: 1 },
      { id: 'side', label: 'Lateral', length: sideHeight, width: D, thickness: t, grain: 'length', qty: 2 },
      { id: 'shelf', label: 'Entrepaño', length: span, width: D, thickness: t, grain: 'length', qty: 1 },
    ];
    const placements = [
      { panelId: 'side', instance: 0, position: [-(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
      { panelId: 'side', instance: 1, position: [(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
      { panelId: 'shelf', instance: 0, position: [0, SHELF_CLEARANCE + t / 2, 0], size: [span, t, D] },
      { panelId: 'top', instance: 0, position: [0, H - t / 2, 0], size: [W, t, D] },
    ];
    const steps = [
      {
        order: 1,
        title: 'Prepara y marca',
        description: `Lija todas las piezas y marca en los laterales la posición del entrepaño a ${SHELF_CLEARANCE} mm del piso.`,
        panelRefs: ['side'],
      },
      {
        order: 2,
        title: 'Une el entrepaño',
        description: 'Fija el entrepaño entre los dos laterales con 2 tornillos confirmat por lado.',
        panelRefs: ['side', 'shelf'],
        explodeOffsets: { shelf: [0, 0, 200] },
      },
      {
        order: 3,
        title: 'Coloca la cubierta',
        description: 'Centra la cubierta sobre los laterales y fíjala desde arriba con 2 confirmat por lado.',
        panelRefs: ['top'],
        explodeOffsets: { top: [0, 150, 0] },
      },
      {
        order: 4,
        title: 'Verifica la escuadra',
        description: 'Apoya la mesa en el piso y comprueba que no cojee antes de apretar del todo.',
        panelRefs: [],
      },
    ];

    return {
      ok: true,
      design: {
        templateId: 'side-table',
        params: p,
        panels,
        placements,
        hardware: [{ type: 'confirmat', size: '5x50', qty: 8 }],
        steps,
      },
    };
  }

  const templates = [
    {
      id: 'bookshelf',
      name: 'Librero',
      description: 'Librero abierto con entrepaños fijos, ideal como primer proyecto.',
      params: bookshelfParams,
      generate: (raw) => generateBookshelf(raw),
    },
    {
      id: 'side-table',
      name: 'Mesa auxiliar',
      description: 'Mesa lateral sencilla con entrepaño inferior.',
      params: sideTableParams,
      generate: (raw) => generateSideTable(raw),
    },
  ];

  // ---- nesting.ts (FFDH shelf packing) ----
  function orient(panel) {
    if (panel.grain === 'width') {
      return { xExtent: panel.length, yExtent: panel.width, rotated: true, canRotate: false };
    }
    return { xExtent: panel.width, yExtent: panel.length, rotated: false, canRotate: panel.grain === 'any' };
  }

  function place(piece, x, y, swapped) {
    return {
      panelId: piece.panelId,
      instance: piece.instance,
      x,
      y,
      length: swapped ? piece.xExtent : piece.yExtent,
      width: swapped ? piece.yExtent : piece.xExtent,
      rotated: swapped ? !piece.rotated : piece.rotated,
    };
  }

  function tryShelf(piece, shelf, config) {
    const x = shelf.xCursor === 0 ? 0 : shelf.xCursor + config.kerf;
    if (piece.yExtent <= shelf.height && x + piece.xExtent <= config.sheetWidth) {
      shelf.xCursor = x + piece.xExtent;
      return place(piece, x, shelf.y, false);
    }
    if (piece.canRotate && piece.xExtent <= shelf.height && x + piece.yExtent <= config.sheetWidth) {
      shelf.xCursor = x + piece.yExtent;
      return place(piece, x, shelf.y, true);
    }
    return null;
  }

  function placePiece(piece, sheets, thickness, config) {
    for (const sheet of sheets) {
      for (const shelf of sheet.shelves) {
        const placed = tryShelf(piece, shelf, config);
        if (placed) {
          sheet.pieces.push(placed);
          return;
        }
      }
      const y = sheet.yCursor === 0 ? 0 : sheet.yCursor + config.kerf;
      if (y + piece.yExtent <= config.sheetLength) {
        sheet.shelves.push({ y, height: piece.yExtent, xCursor: piece.xExtent });
        sheet.yCursor = y + piece.yExtent;
        sheet.pieces.push(place(piece, 0, y, false));
        return;
      }
    }
    sheets.push({
      thickness,
      shelves: [{ y: 0, height: piece.yExtent, xCursor: piece.xExtent }],
      yCursor: piece.yExtent,
      pieces: [place(piece, 0, 0, false)],
    });
  }

  function nest(panels, config = DEFAULT_CONFIG.nesting) {
    const byThickness = new Map();
    for (const panel of panels) {
      const o = orient(panel);
      const fitsAsIs = o.xExtent <= config.sheetWidth && o.yExtent <= config.sheetLength;
      const fitsSwapped = o.canRotate && o.yExtent <= config.sheetWidth && o.xExtent <= config.sheetLength;
      if (!fitsAsIs && !fitsSwapped) {
        throw new Error(
          `Panel "${panel.id}" (${panel.length}x${panel.width}mm) does not fit a ` +
            `${config.sheetWidth}x${config.sheetLength}mm sheet`,
        );
      }
      const base = fitsAsIs
        ? o
        : { xExtent: o.yExtent, yExtent: o.xExtent, rotated: !o.rotated, canRotate: o.canRotate };
      const list = byThickness.get(panel.thickness) ?? [];
      for (let i = 0; i < panel.qty; i++) list.push({ panelId: panel.id, instance: i, ...base });
      byThickness.set(panel.thickness, list);
    }

    const sheets = [];
    const thicknesses = [...byThickness.keys()].sort((a, b) => b - a);
    for (const thickness of thicknesses) {
      const pieces = byThickness.get(thickness);
      pieces.sort((a, b) => b.yExtent - a.yExtent || b.xExtent - a.xExtent);
      const group = [];
      for (const piece of pieces) placePiece(piece, group, thickness, config);
      sheets.push(...group);
    }

    const sheetArea = config.sheetWidth * config.sheetLength;
    const pieceArea = sheets.flatMap((s) => s.pieces).reduce((sum, p) => sum + p.length * p.width, 0);
    const wastePercent = sheets.length === 0 ? 0 : (1 - pieceArea / (sheets.length * sheetArea)) * 100;

    return { sheets: sheets.map((s) => ({ thickness: s.thickness, pieces: s.pieces })), wastePercent };
  }

  function estimateCost(result, pricePerSheetMXN) {
    return result.sheets.length * pricePerSheetMXN;
  }

  window.PlyEngine = {
    DEFAULT_CONFIG,
    HARDWARE_LABELS,
    templates,
    nest,
    estimateCost,
    resolveParams,
  };
})();
