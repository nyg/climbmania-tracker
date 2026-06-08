import React from 'react';

export function BlockGrid({ tops = [], zones = [], total = 30 }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 10 }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const isTop  = tops.includes(n);
        const isZone = zones.includes(n);
        const bg     = isTop ? '#16a34a' : isZone ? '#d97706' : '#1e2035';
        const label  = isTop ? 'T' : isZone ? 'Z' : '';
        const color  = isTop || isZone ? '#fff' : '#3a3a5c';
        return (
          <div
            key={n}
            title={`Block ${n}: ${isTop ? 'TOP ✓' : isZone ? 'ZONE only' : '—'}`}
            style={{
              width: 26, height: 26, borderRadius: 4,
              background: bg, color, fontWeight: 800, fontSize: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'monospace', cursor: 'default',
              border: '1px solid rgba(255,255,255,0.04)',
              transition: 'transform 0.1s',
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, max, color = '#22c55e' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: '#12121e', borderRadius: 6, height: 8, overflow: 'hidden', flex: 1 }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: color,
        borderRadius: 6, transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

export function StatCard({ label, value }) {
  return (
    <div style={{
      padding: '12px 14px', background: '#13131f',
      borderRadius: 10, border: '1px solid #1e293b',
    }}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{value}</div>
    </div>
  );
}
