import type {
  EngineConfig,
  ParamSpec,
  PlywoodThickness,
  TemplateParams,
  ValidationIssue,
} from './types.ts';

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

/** Max unsupported span check for a horizontal panel. Null when safe. */
export function spanIssue(
  span: number,
  thickness: PlywoodThickness,
  config: EngineConfig,
): ValidationIssue | null {
  const max = config.spanLimits[thickness];
  if (span <= max) return null;
  return {
    message:
      `El claro de ${span} mm supera el máximo seguro de ${max} mm ` +
      `para triplay de ${thickness} mm. Reduce el ancho o usa triplay más grueso.`,
  };
}
