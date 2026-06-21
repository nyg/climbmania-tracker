import React from 'react';
import { useTranslation } from 'react-i18next';
import { BlockGrid, ProgressBar } from './components.jsx';

export default function EventCard({ result, prevTops }) {
  const { t } = useTranslation();
  const { eventId, eventTitle, eventDate, category, rank, points, tops = [], zones = [], totalBlocks } = result;
  const topsCount  = tops.length;
  const zonesCount = zones.length;
  const diff       = prevTops !== null ? topsCount - prevTops : null;

  const diffStyle = diff === null ? null : {
    color:      diff > 0 ? '#22c55e' : diff < 0 ? '#f87171' : 'var(--text-faint)',
    background: diff > 0 ? 'var(--diff-pos-bg)' : diff < 0 ? 'var(--diff-neg-bg)' : 'var(--diff-neutral-bg)',
  };

  return (
    <div style={{
      padding: '18px 22px', background: 'var(--bg-card)',
      borderRadius: 12, border: '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#6366f1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>
            #{eventId}{eventDate ? ` · ${eventDate}` : ''}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {eventTitle.replace(/Climbmania\s*[:\-]?\s*/i, '')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-ultra-faint)' }}>{category}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-secondary)' }}>{t('rank', { rank })}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('pts', { points })}</div>
        </div>
      </div>

      {/* Counts + diff badge */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#22c55e' }}>{topsCount}</span>
          <span style={{ fontSize: 11, color: 'var(--text-ultra-faint)' }}>{t('topsLabel', { total: totalBlocks })}</span>
        </div>
        {zonesCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>{zonesCount}</span>
            <span style={{ fontSize: 11, color: 'var(--text-ultra-faint)' }}>{t('zonesOnly')}</span>
          </div>
        )}
        {diff !== null && (
          <div style={{
            marginLeft: 'auto', fontSize: 12, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20, ...diffStyle,
          }}>
            {diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : t('diffSame')}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-ultra-faint)', width: 28 }}>{t('topsProgressLabel')}</span>
        <ProgressBar value={topsCount} max={totalBlocks} color="#22c55e" />
        <span style={{ fontSize: 10, color: '#22c55e', width: 36 }}>
          {totalBlocks > 0 ? Math.round(topsCount / totalBlocks * 100) : 0}%
        </span>
      </div>

      {/* Block grid */}
      <BlockGrid tops={tops} zones={zones} total={totalBlocks} />
    </div>
  );
}
