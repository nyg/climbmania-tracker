import React from 'react';
import { useTranslation } from 'react-i18next';

export function BlockGrid({ tops = [], zones = [], total = 30 }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 10 }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const isTop  = tops.includes(n);
        const isZone = zones.includes(n);
        const bg     = isTop ? '#16a34a' : isZone ? '#d97706' : 'var(--bg-block-empty)';
        const label  = String(n);
        const color  = isTop || isZone ? '#fff' : 'var(--text-block-empty)';
        const tooltip = isTop ? t('blockTop', { n }) : isZone ? t('blockZone', { n }) : t('blockEmpty', { n });
        return (
          <div
            key={n}
            title={tooltip}
            style={{
              width: 26, height: 26, borderRadius: 4,
              background: bg, color, fontWeight: 800, fontSize: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'monospace', cursor: 'default',
              border: '1px solid rgba(128,128,128,0.12)',
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
    <div style={{ background: 'var(--bg-progress)', borderRadius: 6, height: 8, overflow: 'hidden', flex: 1 }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: color,
        borderRadius: 6, transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

export function StatCard({ label, value, subtitle, isMobile = false }) {
  return (
    <div style={{
      padding: isMobile ? '10px 12px' : '12px 14px',
      background: 'var(--bg-card-2)',
      borderRadius: 10, border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-ultra-faint)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: '#6366f1', lineHeight: 1.2 }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
