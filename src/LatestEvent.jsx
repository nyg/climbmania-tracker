import { useTranslation } from 'react-i18next'

import { EventHeading } from './components.jsx'

const PODIUM_SIZE = 3
const ADULT_AGE = 18

function isWomenCategory(category) {
   return /\bFemmes\b/.test(category.name)
}

function ageGroupOrder({ name }) {
   if (name.startsWith('OPEN')) {
      return 0
   }
   const age = Number(name.match(/^M(\d+)\b/)?.[1])
   return age < ADULT_AGE ? 1 + ADULT_AGE - age : 1
}

function adultsFirst(categories) {
   return [...categories].sort((a, b) => ageGroupOrder(a) - ageGroupOrder(b))
}

function latestOf(events) {
   return events.reduce((latest, event) => (
      event.date > latest.date || (event.date === latest.date && event.id > latest.id) ? event : latest
   ))
}

export default function LatestEvent({ events, mergeMap, isMobile = false }) {
   const { t } = useTranslation()
   if (!events.length) {
      return null
   }
   const event = latestOf(events)
   const shownRanks = isMobile ? 1 : PODIUM_SIZE
   const columns = [
      event.categories.filter(category => !isWomenCategory(category)),
      event.categories.filter(isWomenCategory),
   ]

   return (
      <div style={{
         padding: '18px 22px', background: 'var(--bg-card)',
         borderRadius: 12, border: '1px solid var(--border)', marginBottom: 28,
      }}>
         <h2 style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 6 }}>
            {t('latestEvent')}
         </h2>
         <EventHeading eventId={event.id} title={event.title} date={event.date} isMobile={isMobile} />
         <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '18px 32px', marginTop: 16 }}>
            {columns.map((categories, index) => (
               <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {adultsFirst(categories).map(category => (
                     <div key={category.name}>
                        <div style={{ fontSize: 11, color: 'var(--text-ultra-faint)', marginBottom: 6 }}>{category.name}</div>
                        <ol role="list" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                           {category.athletes.filter(athlete => athlete.rank <= shownRanks).map(athlete => {
                              const listedAs = athlete.listedName ?? athlete.name
                              const name = mergeMap.get(listedAs) ?? listedAs
                              return (
                                 <li key={listedAs} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13 }}>
                                    {!isMobile && <span style={{ color: 'var(--text-faint)' }}>{athlete.rank}</span>}
                                    <a href={`#${encodeURIComponent(name)}`} style={{ minWidth: 0, overflowWrap: 'anywhere', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
                                       {name}
                                    </a>
                                 </li>
                              )
                           })}
                        </ol>
                     </div>
                  ))}
               </div>
            ))}
         </div>
      </div>
   )
}
