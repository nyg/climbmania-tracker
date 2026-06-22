import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from './components.jsx';
import EventCard from './EventCard.jsx';

function useIsMobile(breakpoint = 600) {
  const mq = typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpoint}px)`) : null;
  const [isMobile, setIsMobile] = useState(mq ? mq.matches : false);
  useEffect(() => {
    if (!mq) return;
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return isMobile;
}

function getInitialTheme() {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function searchEvents(events, query, exact = false) {
  const q = query.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const results = [];

  for (const event of events) {
    for (const category of event.categories ?? []) {
      for (const athlete of category.athletes ?? []) {
        const lower = athlete.name.toLowerCase();
        const match = exact
          ? lower === q
          : tokens.every(tok => lower.includes(tok));
        if (match) {
          results.push({
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.date,
            category: category.name,
            rank: athlete.rank,
            points: athlete.points,
            tops: athlete.tops,
            zones: athlete.zones,
            totalBlocks: athlete.totalBlocks,
            totalAthletes: category.athletes.length,
          });
        }
      }
    }
  }

  return results.sort((a, b) => {
    const dateDiff = new Date(b.eventDate) - new Date(a.eventDate);
    return dateDiff !== 0 ? dateDiff : b.eventId - a.eventId;
  });
}

export default function App() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [theme, setTheme]             = useState(getInitialTheme);
  const [data, setData]               = useState(null);
  const [loadErr, setLoadErr]         = useState(null);
  const [name, setName]               = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [exactSearch, setExactSearch] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredSuggestion, setHoveredSuggestion] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}events.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setLoadErr(e.message));
  }, []);

  const allAthleteNames = useMemo(() => {
    if (!data) return [];
    const names = new Set();
    for (const event of data.events ?? []) {
      for (const category of event.categories ?? []) {
        for (const athlete of category.athletes ?? []) {
          names.add(athlete.name);
        }
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const suggestions = useMemo(() => {
    const tokens = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return allAthleteNames.filter(n => {
      const lower = n.toLowerCase();
      return tokens.every(tok => lower.includes(tok));
    });
  }, [name, allAthleteNames]);

  useEffect(() => { setFocusedIndex(-1); }, [suggestions]);

  const handleSearch = () => {
    setSearchQuery(name.trim());
    setExactSearch(false);
    setShowDropdown(false);
  };

  const handleSelect = (athleteName) => {
    setName(athleteName);
    setSearchQuery(athleteName);
    setExactSearch(true);
    setShowDropdown(false);
    setHoveredSuggestion(null);
    setFocusedIndex(-1);
  };

  const results = useMemo(() => {
    if (!data || !searchQuery) return [];
    return searchEvents(data.events ?? [], searchQuery, exactSearch);
  }, [data, searchQuery, exactSearch]);

  const bestTopsResult = results.length ? results.reduce((best, r) => {
    const rate  = (r.tops.length + r.zones.length * 0.5) / r.totalBlocks;
    const bRate = (best.tops.length + best.zones.length * 0.5) / best.totalBlocks;
    if (rate > bRate) return r;
    if (rate === bRate && (r.tops.length + r.zones.length * 0.5) > (best.tops.length + best.zones.length * 0.5)) return r;
    return best;
  }) : null;

  const bestRankResult = results.length ? results.reduce((best, r) => {
    const pct  = (parseInt(r.rank) || 999) / (r.totalAthletes || 1);
    const bPct = (parseInt(best.rank) || 999) / (best.totalAthletes || 1);
    return pct < bPct ? r : best;
  }) : null;

  const bestPointsResult = results.length ? results.reduce((best, r) => r.points > best.points ? r : best) : null;

  return (
    <div style={{
      minHeight: '100vh', padding: '28px 20px',
      maxWidth: 1260, margin: '0 auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: '#6366f1', textTransform: 'uppercase' }}>
            {t('subtitle')}
          </div>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Input + dropdown wrapper */}
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="name-input"
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setShowDropdown(true); }}
                onFocus={() => name.trim() && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setShowDropdown(true);
                    setFocusedIndex(i => Math.min(i + 1, suggestions.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedIndex(i => Math.max(i - 1, -1));
                  } else if (e.key === 'Enter') {
                    if (focusedIndex >= 0 && suggestions[focusedIndex]) {
                      handleSelect(suggestions[focusedIndex]);
                    } else {
                      handleSearch();
                    }
                  } else if (e.key === 'Escape') {
                    setShowDropdown(false);
                    setFocusedIndex(-1);
                  }
                }}
                placeholder={t('inputPlaceholder')}
                disabled={!data && !loadErr}
                style={{
                  fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: -0.5,
                  background: 'transparent', border: 'none', borderBottom: '2px solid #6366f1',
                  outline: 'none', padding: '2px 0', fontFamily: 'inherit', width: '100%',
                }}
              />
              {showDropdown && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
                  background: 'var(--bg-dropdown)', border: '1px solid var(--border-dark)', borderRadius: 8,
                  maxHeight: 220, overflowY: 'auto',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}>
                  {suggestions.map((s, idx) => (
                    <div
                      key={s}
                      onMouseDown={() => handleSelect(s)}
                      onMouseEnter={() => setHoveredSuggestion(s)}
                      onMouseLeave={() => setHoveredSuggestion(null)}
                      style={{
                        padding: '9px 14px',
                        fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)',
                        cursor: 'pointer', letterSpacing: 0,
                        background: (hoveredSuggestion === s || focusedIndex === idx) ? 'var(--bg-suggestion-hover)' : 'transparent',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={!data && !loadErr}
              style={{
                fontSize: 13, fontWeight: 700, color: '#f8fafc',
                background: '#6366f1', border: 'none', borderRadius: 8,
                padding: '6px 18px', cursor: 'pointer', fontFamily: 'inherit',
                opacity: (!data && !loadErr) ? 0.4 : 1,
                flexShrink: 0,
              }}
            >
              {t('searchButton')}
            </button>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 8px',
                cursor: 'pointer', lineHeight: 0,
                color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center',
                flexShrink: 0,
              }}
            >
              {theme === 'dark' ? (
                /* Sun */
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <line x1="12" y1="2"     x2="12" y2="4"/>
                  <line x1="12" y1="20"    x2="12" y2="22"/>
                  <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="2"  y1="12"    x2="4"  y2="12"/>
                  <line x1="20" y1="12"    x2="22" y2="12"/>
                  <line x1="4.22" y1="19.78"  x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                /* Moon */
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </h1>
        {data && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-ultra-faint)' }}>
            {t('eventsLoaded', {
              count: data.events?.length ?? 0,
              date: new Date(data.scrapedAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }),
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 11 }}>
        {[
          ['#16a34a', 'T', t('legendTop')],
          ['#d97706', 'Z', t('legendZone')],
          ['var(--bg-block-empty)', '',  t('legendEmpty')],
        ].map(([c, l, txt]) => (
          <div key={txt} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 16, height: 16, borderRadius: 3, background: c,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: '#fff', fontWeight: 800,
            }}>{l}</div>
            <span style={{ color: 'var(--text-faint)' }}>{txt}</span>
          </div>
        ))}
      </div>

      {/* Load error */}
      {loadErr && (
        <div style={{
          padding: '12px 16px', background: 'var(--error-bg)',
          border: '1px solid var(--error-border)', borderRadius: 8,
          color: 'var(--error-text)', fontSize: 12, marginBottom: 20,
        }}>
          {t('loadError', { error: loadErr })}
        </div>
      )}

      {/* No results hint */}
      {data && searchQuery && results.length === 0 && (
        <div style={{
          padding: '12px 16px', background: 'var(--error-bg)',
          border: '1px solid var(--error-border)', borderRadius: 8,
          color: 'var(--error-text)', fontSize: 12, marginBottom: 20,
        }}>
          {t('notFound', { name: searchQuery })}
        </div>
      )}

      {/* Summary stats */}
      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
          <StatCard label={t('eventsFound')} value={results.length} isMobile={isMobile} />
          <StatCard
            label={t('bestTopsZones')}
            value={(() => {
              if (!bestTopsResult) return '—';
              const s = bestTopsResult.tops.length + bestTopsResult.zones.length * 0.5;
              return `${s % 1 === 0 ? s : s.toFixed(1)} / ${bestTopsResult.totalBlocks}`;
            })()}
            subtitle={bestTopsResult ? `${bestTopsResult.eventTitle} · ${new Date(bestTopsResult.eventDate).getFullYear()}` : undefined}
            isMobile={isMobile}
          />
          <StatCard
            label={t('bestRank')}
            value={bestRankResult ? (
              <>
                #{bestRankResult.rank}
                <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 4 }}>
                  {t('ofCount', { n: bestRankResult.totalAthletes })}
                </span>
              </>
            ) : '—'}
            subtitle={bestRankResult ? `${bestRankResult.eventTitle} · ${new Date(bestRankResult.eventDate).getFullYear()}` : undefined}
            isMobile={isMobile}
          />
          <StatCard
            label={t('bestScore')}
            value={bestPointsResult ? t('pts', { points: bestPointsResult.points }) : '—'}
            subtitle={bestPointsResult ? `${bestPointsResult.eventTitle} · ${new Date(bestPointsResult.eventDate).getFullYear()}` : undefined}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* Event cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {results.map((r, idx) => (
          <EventCard
            key={`${r.eventId}-${r.category}`}
            result={r}
            prevResult={idx < results.length - 1 ? results[idx + 1] : null}
          />
        ))}
      </div>

      {/* Footer */}
      <footer style={{
        marginTop: 40, paddingTop: 16,
        borderTop: '1px solid var(--border)',
        fontSize: 11, color: 'var(--text-ultra-faint)',
        display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center',
      }}>
        <span>{t('footerDisclaimer')}</span>
        <a
          href="https://github.com/nyg/climbmania-tracker"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#6366f1', textDecoration: 'none' }}
        >
          github.com/nyg/climbmania-tracker
        </a>
      </footer>
    </div>
  );
}
