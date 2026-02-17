// api/activity.js — Codeberg Activity Graph
// Vercel serverless function (CommonJS — no "type":"module" in package.json)

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

const THEMES = {
  codeberg: {
    bg: '#1e1e2e', text: '#cdd6f4', subtext: '#a6adc8', border: '#313244',
    levels: ['#313244', '#7d3a1e', '#c4592c', '#e8733a', '#f5a06e'],
  },
  codeberg_light: {
    bg: '#ffffff', text: '#1e1e2e', subtext: '#6c6f85', border: '#e0e0e0',
    levels: ['#ebedf0', '#f5c9a8', '#e8a86a', '#d4722d', '#a84a0e'],
  },
  github: {
    bg: '#0d1117', text: '#e6edf3', subtext: '#8b949e', border: '#21262d',
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  github_light: {
    bg: '#ffffff', text: '#24292f', subtext: '#57606a', border: '#d0d7de',
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
};

async function fetchHeatmap(username) {
  const cacheKey = username.toLowerCase();
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const url = `https://codeberg.org/api/v1/users/${encodeURIComponent(username)}/heatmap`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'codeberg-activity-graph/1.0' },
  });

  if (res.status === 404) throw new Error(`User "${username}" not found on Codeberg`);
  if (!res.ok) throw new Error(`Codeberg API error: ${res.status}`);

  const data = await res.json();
  CACHE.set(cacheKey, { data, ts: Date.now() });
  return data;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildGrid(heatmapData) {
  const byDay = new Map();
  for (const { timestamp, contributions } of heatmapData) {
    const key = dateKey(new Date(timestamp * 1000));
    byDay.set(key, (byDay.get(key) || 0) + contributions);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (6 - today.getDay())); // end of current week (Sat)
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 52 * 7 + 1);

  const weeks = [], monthLabels = [];
  let week = [], lastMonth = -1, col = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const key = dateKey(cursor);
    week.push({ date: new Date(cursor), count: byDay.get(key) || 0, isToday: dateKey(today) === key });

    if (cursor.getMonth() !== lastMonth && cursor.getDay() === 0) {
      monthLabels.push({ col, label: cursor.toLocaleString('default', { month: 'short' }) });
      lastMonth = cursor.getMonth();
    }
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === 0 || cursor > endDate) { weeks.push(week); week = []; col++; }
  }
  if (week.length) weeks.push(week);

  const vals = [...byDay.values()];
  return {
    weeks, monthLabels,
    maxCount: Math.max(...vals, 1),
    total: vals.reduce((a, b) => a + b, 0),
  };
}

function level(count, max) {
  if (!count) return 0;
  const r = count / max;
  return r < 0.15 ? 1 : r < 0.40 ? 2 : r < 0.70 ? 3 : 4;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const CELL=11, GAP=3, STEP=14;
const PAD = { top:36, right:16, bottom:24, left:32 };
const DAY_LABELS = ['','Mon','','Wed','','Fri',''];

function renderSVG(username, grid, theme) {
  const { weeks, monthLabels, total } = grid;
  const W = PAD.left + weeks.length * STEP - GAP + PAD.right;
  const H = PAD.top + 7 * STEP - GAP + PAD.bottom;

  const cells = weeks.flatMap((week, col) =>
    week.map((day, row) => {
      const x = PAD.left + col * STEP, y = PAD.top + row * STEP;
      const fill = theme.levels[level(day.count, grid.maxCount)];
      const stroke = day.isToday ? theme.text : 'none';
      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.5"><title>${esc(dateKey(day.date))}: ${day.count} contribution${day.count!==1?'s':''}</title></rect>`;
    })
  ).join('');

  const monthSVG = monthLabels.map(({col,label}) =>
    `<text x="${PAD.left+col*STEP}" y="${PAD.top-6}" fill="${theme.subtext}" font-size="10" font-family="system-ui,sans-serif">${esc(label)}</text>`
  ).join('');

  const daySVG = DAY_LABELS.map((label,i) => !label ? '' :
    `<text x="${PAD.left-6}" y="${PAD.top+i*STEP+CELL-1}" fill="${theme.subtext}" font-size="9" font-family="system-ui,sans-serif" text-anchor="end">${label}</text>`
  ).join('');

  const lx = W - PAD.right - 5*STEP - 40, ly = H - 14;
  const legend = theme.levels.map((c,i) =>
    `<rect x="${lx+i*STEP}" y="${ly}" width="${CELL}" height="${CELL}" rx="2" fill="${c}"/>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="8" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1"/>
  <text x="${PAD.left}" y="16" fill="${theme.text}" font-size="12" font-weight="600" font-family="system-ui,sans-serif">${esc(username)} — ${total.toLocaleString()} contributions in the last year</text>
  ${monthSVG}${daySVG}${cells}
  <text x="${lx-4}" y="${ly+CELL-1}" fill="${theme.subtext}" font-size="9" font-family="system-ui,sans-serif" text-anchor="end">Less</text>
  ${legend}
  <text x="${lx+5*STEP+2}" y="${ly+CELL-1}" fill="${theme.subtext}" font-size="9" font-family="system-ui,sans-serif">More</text>
</svg>`;
}

function renderError(message, theme) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="80" viewBox="0 0 500 80">
  <rect width="500" height="80" rx="8" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1"/>
  <text x="20" y="35" fill="#f38ba8" font-size="13" font-family="system-ui,sans-serif" font-weight="600">Error</text>
  <text x="20" y="56" fill="${theme.subtext}" font-size="11" font-family="system-ui,sans-serif">${esc(message)}</text>
</svg>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');

  const { user, theme: themeKey = 'codeberg' } = req.query;
  const theme = THEMES[themeKey] || THEMES.codeberg;

  if (!user || !/^[a-zA-Z0-9_.-]+$/.test(user)) {
    return res.status(400).send(renderError('Missing or invalid ?user= parameter', theme));
  }

  try {
    const heatmapData = await fetchHeatmap(user);
    const grid = buildGrid(heatmapData);
    return res.status(200).send(renderSVG(user, grid, theme));
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 502;
    return res.status(status).send(renderError(err.message, theme));
  }
};
