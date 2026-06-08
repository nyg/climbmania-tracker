const EVENT_IDS = Array.from({ length: 50 }, (_, i) => 152 + i); // 152..183

/**
 * Fetch a Climbmania event results page via the local Vite proxy
 * and parse an athlete's block results from the real HTML.
 *
 * The Vite dev server proxies /climbmania/* → https://www.climbmania.ch/*
 * so we avoid CORS entirely — the request is made server-side by Vite.
 */
async function fetchEventPage(eventId) {
  const res = await fetch(`/climbmania/fr/groups/1/events/${eventId}/results`, {
    headers: {
      'Accept': 'text/html',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    }
  });

  if (!res.ok) return null;
  return res.text();
}

function parseAthleteFromHTML(html, eventId, name) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // --- Event name & date ---
  const h1 = doc.querySelector('h1');
  const eventTitle = h1?.textContent.trim() ?? `Event #${eventId}`;

  // Date is usually in a <p> or <span> sibling near the h1
  let eventDate = '';
  const dateEl = h1?.nextElementSibling ?? doc.querySelector('.event-date, time');
  if (dateEl) eventDate = dateEl.textContent.trim();

  // --- Find athlete row ---
  const rows = doc.querySelectorAll('tr');
  let athleteRow = null;
  for (const row of rows) {
    if (row.textContent.toLowerCase().includes(name.toLowerCase())) {
      athleteRow = row;
      break;
    }
  }
  if (!athleteRow) return null;

  const cells = athleteRow.querySelectorAll('td');
  const rank   = cells[0]?.textContent.trim().replace(/\*/g, '') ?? '?';
  const points = parseInt(cells[2]?.textContent.trim()) || 0;

  // --- Parse block cells ---
  // Block detail lives in a nested <table> inside cells[3]
  const blockCell = cells[3];
  const blockTds  = blockCell ? blockCell.querySelectorAll('td') : [];

  const tops  = [];   // block numbers topped
  const zones = [];   // block numbers with zone only (no top)
  let totalBlocks = 0;

  blockTds.forEach((td, idx) => {
    const cls = td.classList;
    const blockNum = idx + 1;
    totalBlocks = blockNum;

    if (cls.contains('top-ok')) {
      tops.push(blockNum);
    } else if (cls.contains('zone-ok')) {
      zones.push(blockNum);
    }
  });

  // Also count header cells to get total block count
  const headerTds = blockCell?.querySelectorAll('tr:first-child td, tr:first-child th') ?? [];
  if (headerTds.length > totalBlocks) totalBlocks = headerTds.length;
  if (totalBlocks === 0) totalBlocks = 30; // fallback

  return { eventId, eventTitle, eventDate, rank, points, tops, zones, totalBlocks };
}

export { EVENT_IDS, fetchEventPage, parseAthleteFromHTML };
