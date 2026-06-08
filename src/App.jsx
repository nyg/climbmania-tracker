import React, { useState, useCallback } from 'react';
import { EVENT_IDS, fetchEventPage, parseAthleteFromHTML } from './fetcher.js';
import { ProgressBar, StatCard } from './components.jsx';
import EventCard from './EventCard.jsx';

const DELAY_MS = 200; // polite delay between requests (ms)

export default function App() {
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, id: 0 });
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState(null);
  const [name, setName]         = useState('');

  const runScan = useCallback(async () => {
    setLoading(true);
    setResults([]);
    setDone(false);
    setError(null);

    const found = [];
    setProgress({ current: 0, total: EVENT_IDS.length, id: 0 });

    for (let i = 0; i < EVENT_IDS.length; i++) {
      const id = EVENT_IDS[i];
      setProgress({ current: i + 1, total: EVENT_IDS.length, id });

      try {
        const html = await fetchEventPage(id);
        if (html) {
          const result = parseAthleteFromHTML(html, id, name);
          if (result) {
            found.push(result);
            setResults([...found]); // update live
          }
        }
      } catch (e) {
        console.warn(`Event #${id} failed:`, e.message);
      }

      if (i < EVENT_IDS.length - 1) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    setLoading(false);
    setDone(true);
    if (found.length === 0) {
      setError(`"${name}" was not found in any event from #152 to #183.`);
    }
  }, [name]);

  const sorted = [...results].sort((a, b) => a.eventId - b.eventId);

  const bestTops   = sorted.length ? Math.max(...sorted.map(r => r.tops.length)) : 0;
  const bestRank   = sorted.length ? Math.min(...sorted.map(r => parseInt(r.rank) || 999)) : '—';
  const bestPoints = sorted.length ? Math.max(...sorted.map(r => r.points)) : 0;
  const totalBlocks = sorted[0]?.totalBlocks || 30;

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
            onChange={e => { setName(e.target.value); setDone(false); setResults([]); setError(null); }}
            placeholder="Enter athlete name…"
            disabled={loading}
            style={{
              fontSize: 26, fontWeight: 900, color: '#f8fafc', letterSpacing: -0.5,
              background: 'transparent', border: 'none', borderBottom: '2px solid #6366f1',
              outline: 'none', padding: '2px 0', fontFamily: 'inherit', width: '100%',
            }}
          />
        </h1>
        <div style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>
          Scanning events #152 (Le Môll · 30 Nov 2024) → #183 (TOTEM Vevey · May 2026)
        </div>
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

      {/* Scan button */}
      {!loading && !done && (
        <button
          onClick={runScan}
          disabled={!name.trim()}
          style={{
            background: name.trim() ? '#6366f1' : '#1e2035',
            color: name.trim() ? '#fff' : '#475569',
            border: 'none',
            borderRadius: 8, padding: '11px 26px', fontSize: 13,
            fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default',
            fontFamily: 'inherit', letterSpacing: 1, marginBottom: 28,
          }}
        >
          ▶ SCAN ALL EVENTS
        </button>
      )}

      {/* Progress */}
      {loading && (
        <div style={{
          marginBottom: 24, padding: '14px 18px',
          background: '#13131f', borderRadius: 10, border: '1px solid #1e293b',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>Fetching event #{progress.id}…</span>
            <span style={{ color: '#6366f1', fontWeight: 700 }}>{progress.current} / {progress.total}</span>
          </div>
          <ProgressBar value={progress.current} max={progress.total} color="#6366f1" />
          {results.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#22c55e' }}>
              ✓ Found in {results.length} event{results.length !== 1 ? 's' : ''} so far
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', background: '#1c0a0a',
          border: '1px solid #7f1d1d', borderRadius: 8,
          color: '#fca5a5', fontSize: 12, marginBottom: 20,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Summary stats */}
      {sorted.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
          <StatCard label="Events found" value={sorted.length} />
          <StatCard label="Best tops"    value={`${bestTops} / ${totalBlocks}`} />
          <StatCard label="Best rank"    value={`#${bestRank}`} />
          <StatCard label="Best score"   value={`${bestPoints} pts`} />
        </div>
      )}

      {/* Event cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {sorted.map((r, idx) => (
          <EventCard
            key={r.eventId}
            result={r}
            prevTops={idx > 0 ? sorted[idx - 1].tops.length : null}
          />
        ))}
      </div>

      {/* Done banner */}
      {done && sorted.length > 0 && (
        <div style={{
          marginTop: 24, padding: '14px 18px', background: '#052e16',
          borderRadius: 10, border: '1px solid #14532d',
          fontSize: 12, color: '#86efac',
        }}>
          ✅ Scan complete — {name} found in {sorted.length} event{sorted.length !== 1 ? 's' : ''}.
        </div>
      )}

      {done && (
        <button
          onClick={runScan}
          style={{
            marginTop: 16, background: 'transparent', color: '#6366f1',
            border: '1px solid #6366f1', borderRadius: 8,
            padding: '9px 20px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ↺ Scan again
        </button>
      )}
    </div>
  );
}
