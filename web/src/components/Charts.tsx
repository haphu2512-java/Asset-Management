import { useState } from 'react';
import { formatCompact } from '@shared/reports';
import { shortDate } from '../hooks';

type Slice = { label: string; color: string; amount: number };

export function DonutChart({ items, size = 150, centerLabel, centerValue }: { items: Slice[]; size?: number; centerLabel?: string; centerValue?: string }) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Biểu đồ cơ cấu" style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="13" />
      {total > 0
        ? items.map((i) => {
            const len = (i.amount / total) * c;
            const el = (
              <circle
                key={i.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={i.color}
                strokeWidth="13"
                strokeDasharray={`${Math.max(0, len - 0.8)} ${c - Math.max(0, len - 0.8)}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
              >
                <title>{i.label}</title>
              </circle>
            );
            offset += len;
            return el;
          })
        : null}
      {centerLabel ? (
        <text x="50" y="46" textAnchor="middle" fontSize="7" fill="var(--muted)">
          {centerLabel}
        </text>
      ) : null}
      {centerValue ? (
        <text x="50" y="57" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text)">
          {centerValue}
        </text>
      ) : null}
    </svg>
  );
}

type Point = { date: string; value: number };

export function LineChart({ points, height = 160, hidden }: { points: Point[]; height?: number; hidden?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 600;
  const H = height;
  const pad = { l: 8, r: 8, t: 12, b: 20 };
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)} ${H - pad.b} L${x(0)} ${H - pad.b} Z`;
  const up = points[points.length - 1].value >= points[0].value;
  const color = up ? 'var(--income)' : 'var(--expense)';
  const h = hover !== null ? points[hover] : null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      role="img"
      aria-label="Biểu đồ tài sản ròng theo thời gian"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
      }}
      onMouseLeave={() => setHover(null)}
      style={{ display: 'block' }}
    >
      <path d={area} fill={color} opacity="0.1" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <text x={pad.l} y={H - 4} className="chart-tip">
        {shortDate(points[0].date)}
      </text>
      <text x={W - pad.r} y={H - 4} textAnchor="end" className="chart-tip">
        {shortDate(points[points.length - 1].date)}
      </text>
      {h && hover !== null ? (
        <>
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
          <circle cx={x(hover)} cy={y(h.value)} r="4" fill={color} />
          <text x={Math.min(Math.max(x(hover), 70), W - 70)} y={10} textAnchor="middle" className="chart-tip" style={{ fill: 'var(--text)', fontWeight: 700 }}>
            {shortDate(h.date)}: {hidden ? '••••' : formatCompact(h.value)}
          </text>
        </>
      ) : null}
    </svg>
  );
}

export function BarChart({ months, hidden }: { months: { month: string; income: number; expense: number }[]; hidden?: boolean }) {
  const W = 600;
  const H = 200;
  const pad = { l: 8, r: 8, t: 16, b: 22 };
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const slot = (W - pad.l - pad.r) / months.length;
  const bar = Math.min(16, slot / 2 - 3);
  const h = (v: number) => (v / max) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Thu và chi theo tháng" style={{ display: 'block' }}>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--border)" />
      {months.map((m, i) => {
        const cx = pad.l + slot * i + slot / 2;
        return (
          <g key={m.month}>
            <rect x={cx - bar - 1} y={H - pad.b - h(m.income)} width={bar} height={h(m.income)} rx="3" fill="var(--income)">
              <title>{`T${Number(m.month.slice(5))} thu: ${hidden ? '••••' : formatCompact(m.income)}`}</title>
            </rect>
            <rect x={cx + 1} y={H - pad.b - h(m.expense)} width={bar} height={h(m.expense)} rx="3" fill="var(--expense)">
              <title>{`T${Number(m.month.slice(5))} chi: ${hidden ? '••••' : formatCompact(m.expense)}`}</title>
            </rect>
            <text x={cx} y={H - 6} textAnchor="middle" className="chart-tip">
              T{Number(m.month.slice(5))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
