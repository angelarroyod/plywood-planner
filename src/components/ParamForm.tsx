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
    <section className="mt-8">
      <h2 className="rule-label">Medidas</h2>
      <div className="mt-4 space-y-5">
        {template.params.map((spec) => (
          <Field
            key={spec.key}
            spec={spec}
            value={params[spec.key] ?? spec.default}
            issues={issues.filter((i) => i.paramKey === spec.key)}
            onChange={(v) => setParam(spec.key, v)}
          />
        ))}
      </div>

      {general.length > 0 && (
        <div className="mt-5 rounded-md border-l-2 border-cut bg-cut-tint px-3 py-2">
          {general.map((issue, n) => (
            <p key={n} className="text-xs leading-relaxed text-cut">
              {issue.message}
            </p>
          ))}
        </div>
      )}

      <h2 className="rule-label mt-8">Vista</h2>
      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-rule bg-panel px-3 py-2.5 transition-colors hover:border-ink-soft">
        <span className="text-sm">Vista explosionada</span>
        <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
          <input
            type="checkbox"
            checked={exploded}
            onChange={toggleExploded}
            className="peer sr-only"
          />
          <span className="h-5 w-9 rounded-full bg-rule transition-colors peer-checked:bg-ink" />
          <span className="absolute left-0.5 h-4 w-4 rounded-full bg-panel shadow-sm transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
    </section>
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
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm leading-tight" htmlFor={spec.key}>
          {spec.label}
        </label>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums ${
            hasError
              ? 'border-cut/40 bg-cut-tint text-cut'
              : 'border-rule bg-ply-tint/50 text-ply-deep'
          }`}
        >
          {value}
          {spec.unit && <span className="text-ink-soft/70"> {spec.unit}</span>}
        </span>
      </div>

      {spec.kind === 'number' ? (
        <>
          <input
            id={spec.key}
            type="range"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={value}
            aria-label={spec.label}
            data-invalid={hasError}
            onChange={(e) => onChange(Number(e.target.value))}
            className="mt-1"
          />
          <div className="-mt-1 flex justify-between font-mono text-[9px] tabular-nums text-ink-soft/60">
            <span>{spec.min}</span>
            <span>{spec.max}</span>
          </div>
        </>
      ) : (
        <div className="mt-2 flex gap-1.5">
          {spec.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              aria-pressed={opt === value}
              className={`flex-1 rounded border py-1.5 font-mono text-xs tabular-nums transition-colors ${
                opt === value
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule bg-panel text-ink-soft hover:border-ink-soft hover:text-ink'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {issues.map((issue, n) => (
        <p key={n} className="mt-1.5 border-l-2 border-cut pl-2 text-xs leading-relaxed text-cut">
          {issue.message}
        </p>
      ))}
    </div>
  );
}
