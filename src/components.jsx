import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { blockValues, earnedPoints } from './scoring.js';

const TOOLTIP_GAP = 6;

function anchorOf(n, element) {
  return { n, left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth };
}

function BlockTooltip({ anchor, wrapperRef, title, values, scoresZones, isTop, isZone, approximate }) {
  const { t, i18n } = useTranslation();
  const tooltipRef = useRef(null);
  const [left, setLeft] = useState(0);

  useLayoutEffect(() => {
    const width = tooltipRef.current.offsetWidth;
    const centred = anchor.left + anchor.width / 2 - width / 2;
    setLeft(Math.max(0, Math.min(centred, wrapperRef.current.clientWidth - width)));
  }, [anchor, wrapperRef]);

  const formatPoints = (value, sign = '') => t('pts', {
    points: `${approximate ? '≈ ' : ''}${sign}${value.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
  });
  const earned = earnedPoints(values, isTop, isZone);
  const rows = [
    { key: 'top', value: values.top, count: values.topCount, earned: isTop, swatch: '#16a34a' },
    ...(scoresZones ? [{ key: 'zone', value: values.zone, count: values.zoneCount, earned: isTop || isZone, swatch: '#d97706' }] : []),
  ];

  return (
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: 'absolute', top: anchor.top - TOOLTIP_GAP, left, transform: 'translateY(-100%)',
        zIndex: 100, pointerEvents: 'none', whiteSpace: 'nowrap',
        padding: '8px 10px', borderRadius: 8,
        background: 'var(--bg-dropdown)', border: '1px solid var(--border-dark)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        fontSize: 11, color: 'var(--text-secondary)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontWeight: 700, marginBottom: 6 }}>
        <span>{title}</span>
        {earned > 0 && <span style={{ color: '#6366f1' }}>{formatPoints(earned, '+')}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', columnGap: 12, rowGap: 3, alignItems: 'center' }}>
        {rows.map(row => {
          const emphasis = row.earned
            ? { fontWeight: 700, color: 'var(--text-secondary)' }
            : { fontWeight: 400, color: 'var(--text-faint)' };
          return (
            <React.Fragment key={row.key}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, ...emphasis }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: row.earned ? row.swatch : 'var(--bg-block-empty)',
                }} />
                {t(row.key)}
              </span>
              <span style={{ textAlign: 'right', ...emphasis }}>
                {row.value === null ? '—' : formatPoints(row.value)}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--text-faint)' }}>
                {t('climbers', { count: row.count })}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function BlockGrid({ tops = [], zones = [], total = 30, counts, approximate = false }) {
  const { t } = useTranslation();
  const wrapperRef = useRef(null);
  const lastPointerType = useRef('mouse');
  const [open, setOpen] = useState(null);
  const isOpen = open !== null;

  useEffect(() => {
    if (!isOpen) return;
    const closeUnlessBlockPressed = e => {
      const wrapper = wrapperRef.current;
      if (!wrapper.contains(e.target) || e.target === wrapper) setOpen(null);
    };
    document.addEventListener('pointerdown', closeUnlessBlockPressed);
    return () => document.removeEventListener('pointerdown', closeUnlessBlockPressed);
  }, [isOpen]);

  const titleOf = n => tops.includes(n) ? t('blockTop', { n }) : zones.includes(n) ? t('blockZone', { n }) : t('blockEmpty', { n });

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 10 }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const isTop  = tops.includes(n);
        const isZone = zones.includes(n);
        const bg     = isTop ? '#16a34a' : isZone ? '#d97706' : 'var(--bg-block-empty)';
        const label  = String(n);
        const color  = isTop || isZone ? '#fff' : 'var(--text-block-empty)';
        return (
          <div
            key={n}
            role="img"
            aria-label={titleOf(n)}
            onPointerEnter={e => { if (e.pointerType === 'mouse') setOpen(anchorOf(n, e.currentTarget)); }}
            onPointerLeave={e => { if (e.pointerType === 'mouse') setOpen(null); }}
            onPointerDown={e => { lastPointerType.current = e.pointerType; }}
            onClick={e => {
              if (lastPointerType.current === 'mouse') return;
              const anchor = anchorOf(n, e.currentTarget);
              setOpen(current => current?.n === n ? null : anchor);
            }}
            style={{
              width: 26, height: 26, borderRadius: 4,
              background: bg, color, fontWeight: 800, fontSize: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'monospace', cursor: 'default',
              border: '1px solid rgba(128,128,128,0.12)',
              outline: open?.n === n ? '2px solid #6366f1' : 'none',
              transition: 'transform 0.1s',
            }}
          >
            {label}
          </div>
        );
      })}
      {isOpen && (
        <BlockTooltip
          anchor={open}
          wrapperRef={wrapperRef}
          title={titleOf(open.n)}
          values={blockValues(counts, open.n)}
          scoresZones={counts.zones !== null}
          isTop={tops.includes(open.n)}
          isZone={zones.includes(open.n)}
          approximate={approximate}
        />
      )}
    </div>
  );
}

export function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
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
