import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

const THEMES = {
  codeberg: {
    bg: '#1e1e2e',
    text: '#cdd6f4',
    subtext: '#a6adc8',
    border: '#313244',
    levels: ['#313244', '#7d3a1e', '#c4592c', '#e8733a', '#f5a06e'],
  },
  codeberg_light: {
    bg: '#ffffff',
    text: '#1e1e2e',
    subtext: '#6c6f85',
    border: '#e0e0e0',
    levels: ['#ebedf0', '#f5c9a8', '#e8a86a', '#d4722d', '#a84a0e'],
  },
  github: {
    bg: '#0d1117',
    text: '#e6edf3',
    subtext: '#8b949e',
    border: '#21262d',
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  github_light: {
    bg: '#ffffff',
    text: '#24292f',
    subtext: '#57606a',
    border: '#d0d7de',
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
};

async function fetchHeatmap(username) {
  const cacheKey = username.toLowerCase();
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const url = `https://codeberg.org/api/v1/users/${encodeURIComponent(username)}/heatmap`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'codeberg-activity-graph/1.0',
    },
    cache: 'no-store',
  });

  if (res.status === 404) throw new Error(`User "${username}" not found on Codeberg`);
  if (!res.ok) throw new Error(`Codeberg API error: ${res.status}`);

  const data = await res.json();
  CACHE.set(cacheKey, { data, ts: Date.now() });
  return data;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
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
  endDate.setDate(today.getDate() + (6 - today.getDay()));
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 52 * 7 + 1);

  const weeks = [];
  const monthLabels = [];
  let week = [];
  let lastMonth = -1;
  let col = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const key = dateKey(cursor);
    week.push({
      date: new Date(cursor),
      count: byDay.get(key) || 0,
      isToday: dateKey(today) === key,
    });

    if (cursor.getMonth() !== lastMonth && cursor.getDay() === 0) {
      monthLabels.push({ col, label: cursor.toLocaleString('default', { month: 'short' }) });
      lastMonth = cursor.getMonth();
    }

    cursor.setDate(cursor.getDate() + 1);

    if (cursor.getDay() === 0 || cursor > endDate) {
      weeks.push(week);
      week = [];
      col += 1;
    }
  }

  if (week.length) weeks.push(week);

  const vals = [...byDay.values()];
  return {
    weeks,
    monthLabels,
    maxCount: Math.max(...vals, 1),
    total: vals.reduce((a, b) => a + b, 0),
  };
}

function level(count, max) {
  if (!count) return 0;
  const ratio = count / max;
  if (ratio < 0.15) return 1;
  if (ratio < 0.4) return 2;
  if (ratio < 0.7) return 3;
  return 4;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CELL = 11;
const GAP = 3;
const STEP = 14;
const PAD = { top: 36, right: 16, bottom: 24, left: 32 };
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function renderSVG(username, grid, theme) {
  const { weeks, monthLabels, total } = grid;
  const width = PAD.left + weeks.length * STEP - GAP + PAD.right;
  const height = PAD.top + 7 * STEP - GAP + PAD.bottom;

  const cells = weeks
    .flatMap((week, col) =>
      week.map((day, row) => {
        const x = PAD.left + col * STEP;
        const y = PAD.top + row * STEP;
        const fill = theme.levels[level(day.count, grid.maxCount)];
        const stroke = day.isToday ? theme.text : 'none';
        return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.5"><title>${esc(
          dateKey(day.date),
        )}: ${day.count} contribution${day.count !== 1 ? 's' : ''}</title></rect>`;
      }),
    )
    .join('');

  const monthSVG = monthLabels
    .map(
      ({ col, label }) =>
        `<text x="${PAD.left + col * STEP}" y="${PAD.top - 6}" fill="${theme.subtext}" font-size="10" font-family="system-ui,sans-serif">${esc(
          label,
        )}</text>`,
    )
    .join('');

  const daySVG = DAY_LABELS.map((label, index) =>
    !label
      ? ''
      : `<text x="${PAD.left - 6}" y="${PAD.top + index * STEP + CELL - 1}" fill="${theme.subtext}" font-size="9" font-family="system-ui,sans-serif" text-anchor="end">${label}</text>`,
  ).join('');

  const legendX = width - PAD.right - 5 * STEP - 40;
  const legendY = height - 14;
  const legend = theme.levels
    .map(
      (color, index) =>
        `<rect x="${legendX + index * STEP}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${color}"/>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="8" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1"/>
  <text x="${PAD.left}" y="16" fill="${theme.text}" font-size="12" font-weight="600" font-family="system-ui,sans-serif">${esc(
    username,
  )} — ${total.toLocaleString()} contributions in the last year</text>
  ${monthSVG}${daySVG}${cells}
  <text x="${legendX - 4}" y="${legendY + CELL - 1}" fill="${theme.subtext}" font-size="9" font-family="system-ui,sans-serif" text-anchor="end">Less</text>
  ${legend}
  <text x="${legendX + 5 * STEP + 2}" y="${legendY + CELL - 1}" fill="${theme.subtext}" font-size="9" font-family="system-ui,sans-serif">More</text>
</svg>`;
}

function renderError(message, theme) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="80" viewBox="0 0 500 80">
  <rect width="500" height="80" rx="8" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1"/>
  <text x="20" y="35" fill="#f38ba8" font-size="13" font-family="system-ui,sans-serif" font-weight="600">Error</text>
  <text x="20" y="56" fill="${theme.subtext}" font-size="11" font-family="system-ui,sans-serif">${esc(
    message,
  )}</text>
</svg>`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const user = searchParams.get('user');
  const themeKey = searchParams.get('theme') || 'codeberg';
  const theme = THEMES[themeKey] || THEMES.codeberg;

  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
  });

  if (!user || !/^[a-zA-Z0-9_.-]+$/.test(user)) {
    return new NextResponse(renderError('Missing or invalid ?user= parameter', theme), {
      status: 400,
      headers,
    });
  }

  try {
    const heatmapData = await fetchHeatmap(user);
    const grid = buildGrid(heatmapData);
    return new NextResponse(renderSVG(user, grid, theme), { status: 200, headers });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 502;
    return new NextResponse(renderError(err.message, theme), { status, headers });
  }
}
