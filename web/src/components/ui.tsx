import { useEffect, useState, type ReactNode } from 'react';
import { formatChange, formatMonth, parseVndExpression, shiftMonth, formatDigits, type Change } from '@shared/finance';
import { usePrefs } from '@shared/prefs';
import { Icon } from './Icon';

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`card ${className}`} style={style}>
      {children}
    </section>
  );
}

export function CardHeader({ title, icon, right }: { title: string; icon?: string; right?: ReactNode }) {
  return (
    <div className="card-header">
      <h2>
        {icon ? <Icon name={icon} size={18} /> : null}
        {title}
      </h2>
      {right}
    </div>
  );
}

type ButtonProps = {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  small?: boolean;
  block?: boolean;
  icon?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
};

export function Button({ label, onClick, variant = 'primary', small, block, icon, disabled, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn ${variant === 'primary' ? '' : variant} ${small ? 'small' : ''} ${block ? 'block' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? <Icon name={icon} size={small ? 15 : 17} /> : null}
      {label}
    </button>
  );
}

export function IconButton({ icon, label, onClick }: { icon: string; label: string; onClick?: () => void }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'danger' | 'success' | 'warning' | 'info'; children: ReactNode }) {
  return <div className={`banner ${tone}`}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type ChipOption = { id: string; label: string; color?: string };

export function Chips({ options, value, onChange }: { options: ChipOption[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.id || 'none'} type="button" className={`chip ${o.id === value ? 'on' : ''}`} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.color ? <span className="dot" style={{ background: o.color }} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Money input: accepts "23tr", "50k", "35k+20k" and shows the parsed amount underneath. */
export function AmountInput({
  value,
  onChange,
  placeholder = 'Ví dụ: 50k, 1,5tr',
  autoFocus,
  large = true,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  large?: boolean;
}) {
  const parsed = value.trim() ? parseVndExpression(value) : null;
  const showPreview = parsed !== null && formatDigits(parsed) !== value.trim();
  return (
    <>
      <input
        className={`input ${large ? 'amount' : ''} num`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (parsed !== null) onChange(formatDigits(parsed));
        }}
        placeholder={placeholder}
        inputMode="text"
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {showPreview ? <span className="hint num">= {formatDigits(parsed!)} ₫</span> : null}
    </>
  );
}

export function Toggle({ title, hint, checked, onChange }: { title: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="toggle">
      <span className="grow">
        <span className="strong" style={{ fontWeight: 600 }}>{title}</span>
        {hint ? <span className="hint" style={{ display: 'block' }}>{hint}</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function ProgressBar({ ratio, level, color }: { ratio: number; level?: 'ok' | 'warn' | 'over'; color?: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className={`progress ${level && level !== 'ok' ? level : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%`, ...(color && (!level || level === 'ok') ? { background: color } : {}) }} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <span className="badge">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {actionLabel ? <Button label={actionLabel} onClick={onAction} icon="plus" /> : null}
    </div>
  );
}

export function ChangeBadge({ change, label }: { change: Change | null; label?: string }) {
  const { prefs } = usePrefs();
  if (!change) return <span className="caption">Chưa có dữ liệu hôm qua để so sánh.</span>;
  const text =
    prefs.hideBalance && change.percent !== null
      ? `${change.amount > 0 ? '+' : change.amount < 0 ? '-' : ''}${Math.abs(change.percent).toFixed(2).replace('.', ',')}%`
      : prefs.hideBalance
        ? '••••'
        : formatChange(change);
  return (
    <div className="row wrap">
      <span className={`pill num ${change.direction === 'flat' ? '' : change.direction}`}>
        {change.direction === 'up' ? '▲' : change.direction === 'down' ? '▼' : '•'} {text}
      </span>
      {label ? <span className="caption">{label}</span> : null}
    </div>
  );
}

export function MonthNav({ month, onChange, max }: { month: string; onChange: (m: string) => void; max?: string }) {
  return (
    <div className="month-nav">
      <IconButton icon="back" label="Tháng trước" onClick={() => onChange(shiftMonth(month, -1))} />
      <strong>{formatMonth(month)}</strong>
      <button
        type="button"
        className="icon-btn"
        aria-label="Tháng sau"
        disabled={!!max && month >= max}
        style={max && month >= max ? { opacity: 0.3 } : undefined}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <Icon name="next" />
      </button>
    </div>
  );
}

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  onSave?: () => void;
  saveLabel?: string;
  onDelete?: () => void;
  /** Ask before deleting, with this explanation. */
  confirmDelete?: string;
  error?: string;
  wide?: boolean;
};

/** Dialog on desktop, bottom sheet on phones. Enter saves, Escape closes. */
export function Modal({ title, onClose, children, onSave, saveLabel = 'Lưu', onDelete, confirmDelete, error, wide }: ModalProps) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          onSave?.();
        }}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <IconButton icon="close" label="Đóng" onClick={onClose} />
        </div>
        <div className="modal-body">
          {children}
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {confirming ? (
            <Banner tone="warning">
              <div className="stack" style={{ gap: 8 }}>
                <span>{confirmDelete}</span>
                <div className="row">
                  <Button small variant="danger" label="Xoá" onClick={onDelete} />
                  <Button small variant="secondary" label="Giữ lại" onClick={() => setConfirming(false)} />
                </div>
              </div>
            </Banner>
          ) : null}
        </div>
        {onSave || onDelete ? (
          <div className="modal-foot">
            {onDelete ? (
              <Button variant="danger" label="Xoá" icon="trash" onClick={() => (confirmDelete ? setConfirming(true) : onDelete())} />
            ) : null}
            <span className="grow" />
            <Button variant="secondary" label="Huỷ" onClick={onClose} />
            {onSave ? <Button type="submit" label={saveLabel} icon="check" /> : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}

export function DateInput({ value, onChange, min }: { value: string; onChange: (date: string) => void; min?: string }) {
  return <input type="date" className="input" value={value} min={min} onChange={(e) => e.target.value && onChange(e.target.value)} />;
}

export function Legend({ items, format }: { items: { label: string; color: string; amount: number }[]; format: (n: number) => string }) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <div className="legend">
      {items.map((i) => (
        <div className="legend-row" key={i.label}>
          <span className="dot" style={{ background: i.color }} />
          <span className="name">{i.label}</span>
          <span className="caption num">{total > 0 ? Math.round((i.amount / total) * 100) : 0}%</span>
          <span className="strong num">{format(i.amount)}</span>
        </div>
      ))}
    </div>
  );
}
