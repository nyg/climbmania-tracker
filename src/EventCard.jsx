import React from 'react';
import { BlockGrid, ProgressBar } from './components.jsx';

export default function EventCard({ result, prevTops }) {
  const { eventId, eventTitle, eventDate, rank, points, tops = [], zones = [], totalBlocks } = result;
  const topsCount  = tops.length;
  const zonesCount = zones.length;
  const diff       = prevTops !== null ? topsCount - prevTops : null;

  const diffStyle = diff === null ? null : {
    color:      diff > 0 ? '#22c55e' : diff < 0 ? '#f87171' : '#64748b',
    background: diff > 0 ? '#052e16' : diff < 0 ? '#2d0a0a' : '#1a1a2e',
  };

  return (
    <div style={{
      padding: '18px 22px', background: '#0f0f1c',
      borderRadius: 12, border: '1px solid #1e293b',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#6366f1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>
            #{eventId}{eventDate ? ` · ${eventDate}` : ''}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
            {eventTitle.replace(/Climbmania\s*[:\-]?\s*/i, '')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#475569' }}>OPEN Homme</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>Rank #{rank}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{points} pts</div>
        </div>
      </div>

      {/* Counts + diff badge */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#22c55e' }}>{topsCount}</span>
          <span style={{ fontSize: 11, color: '#475569' }}>tops / {totalBlocks}</span>
        </div>
        {zonesCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>{zonesCount}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>zones only</span>
          </div>
        )}
        {diff !== null && (
          <div style={{
            marginLeft: 'auto', fontSize: 12, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20, ...diffStyle,
          }}>
            {diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : '→ same'}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#475569', width: 28 }}>TOPS</span>
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
