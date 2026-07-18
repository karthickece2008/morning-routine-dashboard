import { type ReactNode } from 'react';
import { type ConnectionStatus } from '../lib/types';

// Tiny shared UI primitives so feature components stay declarative and
// don't repeat the same button/badge/field markup.

const TONE_CLASS: Record<string, { bg: string; text: string; dot: string }> = {
  success: { bg: 'var(--mrd-success-soft)', text: 'var(--mrd-success)', dot: 'var(--mrd-success)' },
  warning: { bg: 'var(--mrd-warning-soft)', text: 'var(--mrd-warning)', dot: 'var(--mrd-warning)' },
  danger: { bg: 'var(--mrd-danger-soft)', text: 'var(--mrd-danger)', dot: 'var(--mrd-danger)' },
  info: { bg: 'var(--mrd-info-soft)', text: 'var(--mrd-info)', dot: 'var(--mrd-info)' },
  neutral: { bg: '#eef0f5', text: 'var(--mrd-text-muted)', dot: 'var(--mrd-text-faint)' },
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASS;
}) {
  const t = TONE_CLASS[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: t.bg, color: t.text }}
    >
      {children}
    </span>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'subtle' | 'danger';

const BTN_CLASS: Record<ButtonVariant, string> = {
  primary: 'text-white',
  ghost: 'text-[var(--mrd-text-muted)] hover:text-[var(--mrd-text)]',
  outline: 'border border-[var(--mrd-border-strong)] text-[var(--mrd-text)] bg-white hover:border-[var(--mrd-primary)]',
  subtle: 'bg-[#eef0f5] text-[var(--mrd-text)] hover:bg-[#e3e6ee]',
  danger: 'bg-[var(--mrd-danger-soft)] text-[var(--mrd-danger)] hover:brightness-95',
};

export function Button({
  children,
  variant = 'outline',
  onClick,
  disabled,
  title,
  size = 'md',
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
  type?: 'button' | 'submit';
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`mrd-focus inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${BTN_CLASS[variant]} ${className}`}
      style={variant === 'primary' ? { background: 'var(--mrd-primary)' } : undefined}
    >
      {children}
    </button>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mrd-card p-5 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon && (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--mrd-primary-soft)', color: 'var(--mrd-primary)' }}
            >
              {icon}
            </span>
          )}
          <div>
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--mrd-text-muted)]">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon && <div className="text-[var(--mrd-text-faint)]">{icon}</div>}
      <p className="text-sm font-medium text-[var(--mrd-text-muted)]">{title}</p>
      {hint && <p className="max-w-xs text-xs text-[var(--mrd-text-faint)]">{hint}</p>}
    </div>
  );
}

const STATUS_META: Record<ConnectionStatus, { label: string; color: string }> = {
  unknown: { label: 'Not tested', color: 'var(--mrd-status-unknown)' },
  testing: { label: 'Testing…', color: 'var(--mrd-status-testing)' },
  connected: { label: 'Connected', color: 'var(--mrd-status-connected)' },
  disconnected: { label: 'Disconnected', color: 'var(--mrd-status-disconnected)' },
  error: { label: 'Error', color: 'var(--mrd-status-disconnected)' },
};

export function StatusDot({ status, withLabel = false }: { status: ConnectionStatus; withLabel?: boolean }) {
  const m = STATUS_META[status];
  const pulse = status === 'testing';
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={pulse ? 'mrd-pulse' : ''}
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: m.color,
          boxShadow: `0 0 0 3px ${m.color}22`,
          display: 'inline-block',
        }}
      />
      {withLabel && <span className="text-xs font-medium" style={{ color: m.color }}>{m.label}</span>}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--mrd-text-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mrd-focus w-full rounded-lg border border-[var(--mrd-border-strong)] bg-white px-3 py-2 text-sm text-[var(--mrd-text)] placeholder:text-[var(--mrd-text-faint)]"
      />
      {hint && <span className="mt-1 block text-xs text-[var(--mrd-text-faint)]">{hint}</span>}
    </label>
  );
}
