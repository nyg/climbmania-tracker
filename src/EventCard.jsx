import { useTranslation } from 'react-i18next'

import { BlockGrid, ExternalLinkIcon, ProgressBar } from './components.jsx'
import { isApproximate } from './scoring.js'

const SUPPORTED_LANGS = ['en', 'fr', 'de', 'it']

function formatEventDate(isoDate, lang) {
   return new Date(isoDate)
      .toLocaleDateString(lang || undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function weightedScore(tops, zones) {
   return tops.length + zones.length * 0.5
}

function scorePct(tops, zones, totalBlocks) {
   return totalBlocks > 0 ? weightedScore(tops, zones) / totalBlocks * 100 : 0
}

export default function EventCard({ result, prevResult, isMobile = false }) {
   const { t, i18n } = useTranslation()
   const lang = SUPPORTED_LANGS.includes(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'
   const { athleteName, listedAs, eventId, eventTitle, eventDate, category, rank, points, tops = [], zones = [], totalBlocks, totalAthletes, blockCounts } = result
   const eventUrl = `https://www.climbmania.ch/${lang}/groups/1/events/${eventId}/results`
   const topsCount  = tops.length
   const zonesCount = zones.length
   const score      = weightedScore(tops, zones)
   const pct        = scorePct(tops, zones, totalBlocks)

   const prevPct    = prevResult ? scorePct(prevResult.tops ?? [], prevResult.zones ?? [], prevResult.totalBlocks) : null
   const diff       = prevPct !== null ? Math.round((pct - prevPct) * 10) / 10 : null

   const diffColor = diff === null ? null
      : diff > 0 ? '#22c55e' : diff < 0 ? '#f87171' : 'var(--text-faint)'

   return (
      <div style={{
         padding: '18px 22px', background: 'var(--bg-card)',
         borderRadius: 12, border: '1px solid var(--border)',
      }}>
         {/* Header */}
         <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'baseline', gap: isMobile ? 4 : 12, marginBottom: 10,
         }}>
            <div>
               <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 8px' }}>
                  <span>
                     {eventTitle.replace(/Climbmania\s*[:-]?\s*/i, '')}
                     <span style={{ whiteSpace: 'nowrap' }}>
                        {'\u00A0'}
                        <a href={eventUrl} target="_blank" rel="noopener noreferrer"
                           style={{ color: 'var(--text-ultra-faint)', display: 'inline-flex', lineHeight: 1 }}
                           title="Open event results">
                           <ExternalLinkIcon />
                        </a>
                     </span>
                  </span>
                  {eventDate && (
                     <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexBasis: isMobile ? '100%' : 'auto' }}>
                        {!isMobile && <span style={{ fontSize: 10, color: 'var(--text-ultra-faint)' }}>·</span>}
                        <span style={{ fontSize: 10, color: '#6366f1', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
                           {formatEventDate(eventDate, i18n.language)}
                        </span>
                     </span>
                  )}
               </div>
            </div>
            <div style={{ textAlign: isMobile ? 'left' : 'right', flexShrink: 0 }}>
               <div style={{ fontSize: 11, color: 'var(--text-ultra-faint)' }}>{category}</div>
               {listedAs !== athleteName && (
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{t('listedAs', { name: listedAs, context: /\bFemmes\b/.test(category) ? 'female' : undefined })}</div>
               )}
            </div>
         </div>

         {/* Counts + rank */}
         <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px 12px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
               <span>
                  <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: '#22c55e' }}>{topsCount}T</span>
                  <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, color: 'var(--text-faint)', margin: '0 2px' }}> + </span>
                  <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: '#f59e0b' }}>{zonesCount}Z</span>
               </span>
               <span style={{ fontSize: isMobile ? 12 : 13, color: 'var(--text-muted)' }}>· {points} pts</span>
            </div>
            <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginInlineStart: 'auto' }}>
               {t('rank', { rank })}
               {totalAthletes != null && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 5 }}>
                     {t('ofCount', { n: totalAthletes })}
                  </span>
               )}
            </div>
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
         <BlockGrid tops={tops} zones={zones} total={totalBlocks} counts={blockCounts} approximate={isApproximate(result)} />
      </div>
   )
}
