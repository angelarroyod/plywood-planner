import type { ParamSpec, Stock, TemplateParams, ValidationIssue } from './types.ts';

/** Merge user params over spec defaults. Unknown keys are dropped. */
export function resolveParams(specs: ParamSpec[], params: TemplateParams): TemplateParams {
  const resolved: TemplateParams = {};
  for (const spec of specs) {
    resolved[spec.key] = params[spec.key] ?? spec.default;
  }
  return resolved;
}

/** Range/option checks for every param. Empty array means all good. */
export function paramIssues(specs: ParamSpec[], params: TemplateParams): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const spec of specs) {
    const value = params[spec.key] ?? spec.default;
    if (spec.kind === 'number') {
      const unit = spec.unit ? ` ${spec.unit}` : '';
      if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
        issues.push({
          paramKey: spec.key,
          message: `«${spec.label}» debe estar entre ${spec.min} y ${spec.max}${unit}.`,
        });
      }
    } else if (!spec.options.some((o) => o.value === value)) {
      issues.push({
        paramKey: spec.key,
        message: `«${spec.label}» debe ser uno de: ${spec.options.map((o) => o.label).join(', ')}.`,
      });
    }
  }
  return issues;
}

/** Max unsupported span check for a horizontal panel. Null when safe. */
export function spanIssue(span: number, stock: Stock): ValidationIssue | null {
  if (stock.maxSpan === null) throw new Error(`${stock.label} can never be a shelf`);
  if (span <= stock.maxSpan) return null;
  return {
    message:
      `El claro de ${span} mm supera el máximo seguro de ${stock.maxSpan} mm ` +
      `para ${stock.label.toLowerCase()}. Reduce el ancho o elige un material más grueso.`,
  };
}
