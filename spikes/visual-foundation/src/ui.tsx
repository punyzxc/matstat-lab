import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({ children, variant = 'secondary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button type={type} className={`button button--${variant} ${className}`} {...props}>{children}</button>;
}

export function Panel({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return <section className={`panel ${className}`} aria-label={label}>{children}</section>;
}

export function PanelHeading({ icon, title, trailing }: { icon: ReactNode; title: string; trailing?: ReactNode }) {
  return <div className="panel-heading"><h2>{icon}{title}</h2>{trailing}</div>;
}

export function Slider({ id, label, value, display, min, max, step, onChange }: {
  id: string; label: string; value: number; display: string; min: number; max: number; step: number; onChange: (value: number) => void;
}) {
  const percent = (value - min) / (max - min) * 100;
  return <div className="range-field">
    <div className="field-line"><label htmlFor={id}>{label}</label><span className="range-value">{display}</span></div>
    <input id={id} name={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(event.currentTarget.valueAsNumber)}
      aria-valuetext={display} style={{ background: `linear-gradient(90deg, var(--accent) ${percent}%, var(--track) ${percent}%)` }} />
  </div>;
}

export function Stat({ label, actual, theoretical, id, referenceLabel = 'Theory' }: { label: string; actual: string; theoretical: string; id?: string; referenceLabel?: string }) {
  return <div className="stat"><dt>{label}</dt><dd className="stat-value" data-testid={id}>{actual}</dd><dd className="stat-reference">{referenceLabel} <b>{theoretical}</b></dd></div>;
}

