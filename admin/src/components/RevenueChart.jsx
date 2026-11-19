import { useState } from 'react';
import { compactInr, inr } from '../lib/format';

/**
 * 14-day revenue — single series bar chart in brand brown.
 * Thin bars with rounded tops anchored to the baseline, recessive grid, per-bar hover tooltip,
 * hit targets span the full column. Today's bar is gold so the current day reads at a glance.
 */
export default function RevenueChart({ days }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 220, padL = 44, padB = 26, padT = 12;
  const max = Math.max(...days.map((d) => d.revenue), 0);
  const empty = max === 0;
  const nice = niceMax(Math.max(max, 1000));
  const plotW = W - padL, plotH = H - padB - padT;
  const col = plotW / days.length;
  const barW = Math.min(22, col * 0.56);
  const ticks = [0, 0.5, 1].map((t) => nice * t);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue over the last 14 days">
        {ticks.map((t) => {
          const y = padT + plotH - (t / nice) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="#d9d4cf" strokeDasharray={t ? '3 4' : undefined} strokeWidth="1" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#5d5a57">{compactInr(t)}</text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const h = (d.revenue / nice) * plotH;
          const x = padL + i * col + (col - barW) / 2;
          const y = padT + plotH - h;
          const isToday = i === days.length - 1;
          const r = Math.min(4, h / 2);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * col} y={padT} width={col} height={plotH} fill={hover === i ? 'rgba(201,153,92,.12)' : 'transparent'} />
              {h > 0 && (
                <path
                  d={barPath(x, y, barW, h, r)}
                  fill={isToday ? '#c9995c' : hover === i ? '#2a170d' : '#55331e'}
                />
              )}
              {(i % 2 === days.length % 2 || isToday) && (
                <text x={padL + i * col + col / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill={isToday ? '#3b2314' : '#5d5a57'} fontWeight={isToday ? 600 : 400}>
                  {isToday ? 'Today' : new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {empty && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-sm text-muted">
          No sales in the last 14 days yet
        </p>
      )}
      {hover != null && !empty && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-brown-900 px-3 py-2 text-xs text-white shadow-lift"
          style={{ left: `${((padL + hover * col + col / 2) / W) * 100}%` }}
        >
          <p className="font-medium text-gold-soft">{new Date(days[hover].date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="mt-0.5 whitespace-nowrap">{inr(days[hover].revenue)} · {days[hover].orders} order{days[hover].orders === 1 ? '' : 's'}</p>
        </div>
      )}
    </div>
  );
}

function barPath(x, y, w, h, r) {
  // rounded top corners, square base on the baseline
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
