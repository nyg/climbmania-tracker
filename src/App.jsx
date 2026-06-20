import React, { useState, useEffect, useMemo } from 'react';
import { ProgressBar, StatCard } from './components.jsx';
import EventCard from './EventCard.jsx';

function searchEvents(events, name) {
  const query = name.trim().toLowerCase();
  const results = [];

  for (const event of events) {
    for (const category of event.categories ?? []) {
      for (const athlete of category.athletes ?? []) {
        if (athlete.name.toLowerCase().includes(query)) {
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
          });
        }
      }
    }
  }

  return results.sort((a, b) => a.eventId - b.eventId);
}

export default function App() {
  const [data, setData]     = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [name, setName]     = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}events.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setLoadErr(e.message));
  }, []);

  const results = useMemo(() => {
    if (!data || !name.trim()) return [];
    return searchEvents(data.events ?? [], name);
  }, [data, name]);

  const bestTops   = results.length ? Math.max(...results.map(r => r.tops.length)) : 0;
  const bestRank   = results.length ? Math.min(...results.map(r => parseInt(r.rank) || 999)) : '—';
  const bestPoints = results.length ? Math.max(...results.map(r => r.points)) : 0;
  const totalBlocks = results[0]?.totalBlocks || 30;

  return (
    <div style={{
      minHeight: '100vh', padding: '28px 20px',
      maxWidth: 860, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: '#6366f1', textTransform: 'uppercase', marginBottom: 6 }}>
          Climbmania · Block Progress Tracker
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', letterSpacing: -0.5 }}>
          <input
            className="name-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter athlete name…"
            disabled={!data && !loadErr}
            style={{
              fontSize: 26, fontWeight: 900, color: '#f8fafc', letterSpacing: -0.5,
              background: 'transparent', border: 'none', borderBottom: '2px solid #6366f1',
              outline: 'none', padding: '2px 0', fontFamily: 'inherit', width: '100%',
            }}
          />
        </h1>
        {data && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>
            {data.events?.length ?? 0} events loaded · last scraped {new Date(data.scrapedAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 11 }}>
        {[
          ['#16a34a', 'T', 'Top — block fully completed'],
          ['#d97706', 'Z', 'Zone only — half block'],
          ['#1e2035', '',  'Not completed'],
        ].map(([c, l, txt]) => (
          <div key={txt} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 16, height: 16, borderRadius: 3, background: c,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: '#fff', fontWeight: 800,
            }}>{l}</div>
            <span style={{ color: '#64748b' }}>{txt}</span>
          </div>
        ))}
      </div>

      {/* Loading */}
      {!data && !loadErr && (
        <div style={{
          padding: '14px 18px', background: '#13131f',
          borderRadius: 10, border: '1px solid #1e293b',
          marginBottom: 24, fontSize: 12, color: '#94a3b8',
        }}>
          Loading event data…
          <ProgressBar value={0} max={1} color="#6366f1" />
        </div>
      )}

      {/* Load error */}
      {loadErr && (
        <div style={{
          padding: '12px 16px', background: '#1c0a0a',
          border: '1px solid #7f1d1d', borderRadius: 8,
          color: '#fca5a5', fontSize: 12, marginBottom: 20,
        }}>
          ⚠ Failed to load event data: {loadErr}
        </div>
      )}

      {/* No results hint */}
      {data && name.trim() && results.length === 0 && (
        <div style={{
          padding: '12px 16px', background: '#1c0a0a',
          border: '1px solid #7f1d1d', borderRadius: 8,
          color: '#fca5a5', fontSize: 12, marginBottom: 20,
        }}>
          ⚠ "{name}" was not found in any event.
        </div>
      )}

      {/* Summary stats */}
      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
          <StatCard label="Events found" value={results.length} />
          <StatCard label="Best tops"    value={`${bestTops} / ${totalBlocks}`} />
          <StatCard label="Best rank"    value={`#${bestRank}`} />
          <StatCard label="Best score"   value={`${bestPoints} pts`} />
        </div>
      )}

      {/* Event cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {results.map((r, idx) => (
          <EventCard
            key={`${r.eventId}-${r.category}`}
            result={r}
            prevTops={idx > 0 ? results[idx - 1].tops.length : null}
          />
        ))}
      </div>
    </div>
  );
}

