import React from 'react';
import { useTranslation } from 'react-i18next';
import { BlockGrid, ProgressBar } from './components.jsx';

const SUPPORTED_LANGS = ['en', 'fr', 'de', 'it'];

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

const MONTHS = { January:0, February:1, March:2, April:3, May:4, June:5, July:6, August:7, September:8, October:9, November:10, December:11 };

function parseEventDate(str, lang) {
  const m = str && str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!m || MONTHS[m[2]] === undefined) return str;
  return new Date(+m[3], MONTHS[m[2]], +m[1])
    .toLocaleDateString(lang || undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function weightedScore(tops, zones) {
  return tops.length + zones.length * 0.5;
}

function scorePct(tops, zones, totalBlocks) {
  return totalBlocks > 0 ? weightedScore(tops, zones) / totalBlocks * 100 : 0;
}

export default function EventCard({ result, prevResult }) {
  const { t, i18n } = useTranslation();
  const lang = SUPPORTED_LANGS.includes(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en';
  const { eventId, eventTitle, eventDate, category, rank, points, tops = [], zones = [], totalBlocks, totalAthletes } = result;
  const eventUrl = `https://www.climbmania.ch/${lang}/groups/1/events/${eventId}/results`;
  const topsCount  = tops.length;
  const zonesCount = zones.length;
  const score      = weightedScore(tops, zones);
  const pct        = scorePct(tops, zones, totalBlocks);

  const prevPct    = prevResult ? scorePct(prevResult.tops ?? [], prevResult.zones ?? [], prevResult.totalBlocks) : null;
  const diff       = prevPct !== null ? Math.round((pct - prevPct) * 10) / 10 : null;

  const diffColor = diff === null ? null
    : diff > 0 ? '#22c55e' : diff < 0 ? '#f87171' : 'var(--text-faint)';

  return (
    <div style={{
      padding: '18px 22px', background: 'var(--bg-card)',
      borderRadius: 12, border: '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {eventTitle.replace(/Climbmania\s*[:\-]?\s*/i, '')}
            <a href={eventUrl} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--text-ultra-faint)', display: 'inline-flex', lineHeight: 1 }}
              title="Open event results">
              <ExternalLinkIcon />
            </a>
            {eventDate && (
              <>
                <span style={{ fontSize: 10, color: 'var(--text-ultra-faint)' }}>·</span>
                <span style={{ fontSize: 10, color: '#6366f1', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
                  {parseEventDate(eventDate, i18n.language)}
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-ultra-faint)' }}>{category}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-secondary)' }}>
            {t('rank', { rank })}
            {totalAthletes != null && (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 5 }}>
                {t('ofCount', { n: totalAthletes })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Counts */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{topsCount}T + {zonesCount}Z</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>· {points} pts</span>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-ultra-faint)', whiteSpace: 'nowrap' }}>{t('topsProgressLabel')}</span>
        <ProgressBar value={score} max={totalBlocks} color="#22c55e" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap' }}>
          {Math.round(pct)}%
        </span>
        {diff !== null && (
          <>
            <span style={{ fontSize: 10, color: 'var(--text-ultra-faint)' }}>·</span>
            <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: diffColor }}>
              {diff > 0 ? `▲ +${diff}%` : diff < 0 ? `▼ ${diff}%` : t('diffSame')}
            </span>
          </>
        )}
      </div>

      {/* Block grid */}
      <BlockGrid tops={tops} zones={zones} total={totalBlocks} />
    </div>
  );
}
