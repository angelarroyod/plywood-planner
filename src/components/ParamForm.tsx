import { useState, type CSSProperties, type ReactNode } from 'react';
import type { ParamSpec, TemplateParams, ValidationIssue } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';

interface Props {
  template: { params: ParamSpec[] }; // a wood Template or a WeldTemplate
  params: TemplateParams;
  issues: ValidationIssue[];
  children?: ReactNode; // shown under the fields, before Vista
}

const READOUT_HOLD = 700; // ms the big number lingers after the last change
let readoutTimer: ReturnType<typeof setTimeout> | undefined;

export function ParamForm({ template, params, issues, children }: Props) {
  const setParam = useAppStore((s) => s.setParam);
  const exploded = useAppStore((s) => s.exploded);
  const toggleExploded = useAppStore((s) => s.toggleExploded);

  const general = issues.filter((i) => !i.paramKey);
  const groups = [
    { title: 'Medidas', specs: template.params.filter((s) => s.kind === 'number') },
    { title: 'Opciones', specs: template.params.filter((s) => s.kind === 'select') },
  ];

  return (
    <div className="mt-7">
      {groups.map((g) => (
        <section key={g.title} className="mb-7">
          <h2 className="rule-label">{g.title}</h2>
          <div className="mt-4 space-y-5">
            {g.specs.map((spec) => (
              <Field
                key={spec.key}
                spec={spec}
                value={params[spec.key] ?? spec.default}
                issues={issues.filter((i) => i.paramKey === spec.key)}
                onChange={(v) => setParam(spec.key, v)}
              />
            ))}
          </div>
        </section>
      ))}

      {general.length > 0 && (
        <div className="mb-6 flex gap-2.5 rounded-xl bg-cut-tint px-3.5 py-3 text-sm leading-relaxed text-cut-ink">
          <WarnIcon />
          <div>
            {general.map((issue, n) => (
              <p key={n}>{issue.message}</p>
            ))}
          </div>
        </div>
      )}

      {/* Errors appear and vanish while a slider moves; one polite region reads them out without stealing focus. */}
      <p aria-live="polite" className="sr-only">
        {issues.map((i) => i.message).join(' ')}
      </p>

      {children}

      <h2 className="rule-label mt-7">Vista</h2>
      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-rule px-3.5 py-3 transition-colors hover:border-rule-strong">
        <span className="text-sm font-semibold">Vista explosionada</span>
        <span className="relative inline-flex h-6 w-10 shrink-0 items-center">
          <input type="checkbox" checked={exploded} onChange={toggleExploded} className="peer sr-only" />
          <span className="h-6 w-10 rounded-full bg-rule-strong transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
          <span className="absolute left-1 h-4 w-4 rounded-full bg-panel shadow-[0_1px_2px_rgb(20_26_43/0.3)] transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
    </div>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M10 3 18 17H2L10 3ZM10 8v4M10 14.5h.01" />
    </svg>
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
  const setReadout = useAppStore((s) => s.setReadout);
  const hasError = issues.length > 0;
  const describedBy = hasError ? `${spec.key}-error` : undefined;

  // A draft exists only while typing, so "8" on the way to "860" never jumps the model.
  // Otherwise the field shows `value` itself, the same number the slider, readout and errors use.
  const [draft, setDraft] = useState<string | null>(null);

  function show(v: number) {
    clearTimeout(readoutTimer);
    setReadout({ key: spec.key, label: spec.label, value: v, unit: spec.unit });
    readoutTimer = setTimeout(() => setReadout(null), READOUT_HOLD);
  }

  function commit() {
    if (spec.kind !== 'number' || draft === null) return;
    const n = Math.round(Number(draft));
    setDraft(null);
    if (!Number.isFinite(n) || draft.trim() === '') return;
    const clamped = Math.min(spec.max, Math.max(spec.min, n));
    if (clamped !== value) onChange(clamped);
  }

  if (spec.kind === 'number') {
    const fill = `${((value - spec.min) / (spec.max - spec.min)) * 100}%`;
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-semibold" htmlFor={spec.key}>
            {spec.label}
          </label>
          <span
            className={`flex items-baseline gap-1 rounded-lg border px-2 focus-within:border-accent ${
              hasError ? 'border-cut/50 bg-cut-tint' : 'border-rule bg-raised'
            }`}
          >
            <input
              type="number"
              inputMode="numeric"
              min={spec.min}
              max={spec.max}
              value={draft ?? String(value)}
              aria-label={`${spec.label}${spec.unit ? ` en ${spec.unit}` : ''}`}
              aria-invalid={hasError}
              aria-describedby={describedBy}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              className={`h-9 w-16 bg-transparent text-right font-mono text-[15px] font-bold outline-none ${
                hasError ? 'text-cut-ink' : 'text-accent-ink'
              }`}
            />
            {spec.unit && <span className="text-xs text-ink-faint">{spec.unit}</span>}
          </span>
        </div>
        <input
          id={spec.key}
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          style={{ '--fill': fill } as CSSProperties}
          aria-valuetext={spec.unit ? `${value} ${spec.unit}` : String(value)}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          data-invalid={hasError}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(v);
            show(v);
          }}
          className="mt-1.5"
        />
        <div className="flex justify-between font-mono text-[11px] text-ink-faint">
          <span>{spec.min}</span>
          <span>{spec.max}</span>
        </div>
        <FieldIssues id={describedBy} issues={issues} />
      </div>
    );
  }

  return (
    <div>
      <span className="text-sm font-semibold" id={`${spec.key}-label`}>
        {spec.label}
      </span>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-labelledby={`${spec.key}-label`} aria-describedby={describedBy}>
        {spec.options.map((opt) => {
          const on = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              aria-pressed={on}
              className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors lg:h-9 ${
                on
                  ? 'border-accent bg-accent-tint text-accent-ink'
                  : 'border-rule text-ink-soft hover:border-rule-strong hover:text-ink'
              }`}
            >
              {opt.swatch && (
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-ink/25"
                  style={{ background: opt.swatch }}
                />
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
      <FieldIssues id={describedBy} issues={issues} />
    </div>
  );
}

function FieldIssues({ id, issues }: { id: string | undefined; issues: ValidationIssue[] }) {
  if (!id) return null;
  return (
    <div id={id} className="mt-2 space-y-1">
      {issues.map((issue, n) => (
        <p key={n} className="flex gap-2 text-[13px] leading-relaxed text-cut-ink">
          <WarnIcon />
          {issue.message}
        </p>
      ))}
    </div>
  );
}
