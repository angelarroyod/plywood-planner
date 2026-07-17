import type { ParamSpec, Template, TemplateParams, ValidationIssue } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';

interface Props {
  template: Template;
  params: TemplateParams;
  issues: ValidationIssue[];
}

export function ParamForm({ template, params, issues }: Props) {
  const setParam = useAppStore((s) => s.setParam);
  const exploded = useAppStore((s) => s.exploded);
  const toggleExploded = useAppStore((s) => s.toggleExploded);

  const general = issues.filter((i) => !i.paramKey);

  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-sm font-semibold text-neutral-600">Medidas</h2>
      {template.params.map((spec) => (
        <Field
          key={spec.key}
          spec={spec}
          value={params[spec.key] ?? spec.default}
          issues={issues.filter((i) => i.paramKey === spec.key)}
          onChange={(v) => setParam(spec.key, v)}
        />
      ))}
      {general.map((issue, n) => (
        <p key={n} className="text-sm text-red-600">
          {issue.message}
        </p>
      ))}
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={exploded} onChange={toggleExploded} />
        Vista explosionada
      </label>
    </div>
  );
}

function Field({
  spec,
  value,
  issues,
  onChange,
}: {
  spec: ParamSpec;
  value: number;
  issues: ValidationIssue[];
  onChange: (v: number) => void;
}) {
  const hasError = issues.length > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm">{spec.label}</label>
        <span className="text-sm tabular-nums text-neutral-500">
          {value}
          {spec.unit && ` ${spec.unit}`}
        </span>
      </div>
      {spec.kind === 'number' ? (
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          aria-label={spec.label}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full ${hasError ? 'accent-red-600' : 'accent-amber-700'}`}
        />
      ) : (
        <div className="mt-1 flex gap-2">
          {spec.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`flex-1 rounded border py-1 text-sm ${
                opt === value ? 'border-amber-600 bg-amber-50' : 'border-neutral-200'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {issues.map((issue, n) => (
        <p key={n} className="mt-1 text-sm text-red-600">
          {issue.message}
        </p>
      ))}
    </div>
  );
}
