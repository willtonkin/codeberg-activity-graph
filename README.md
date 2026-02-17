# 🔥 Codeberg Activity Graph

🚀 **Try the live app now:** `https://codeberg-activity-graph.vercel.app/` ✨  
Instant SVGs. No setup. Just paste and go.

Public repo: https://github.com/willtonkin/codeberg-activity-graph

A Next.js app that generates GitHub-style SVG activity graphs for [Codeberg](https://codeberg.org) users — perfect for embedding in GitHub READMEs, personal sites, or portfolios.

## Features

- **Zero dependencies** — pure SVG, no canvas or image libraries needed
- **4 themes** — `codeberg`, `codeberg_light`, `github`, `github_light`
- **Dark mode** themes built-in
- **Month labels** and day-of-week labels
- **1-hour cache** — won't hammer the Codeberg API
- **CORS enabled** — embed anywhere

## Preview

| Theme | Preview |
|-------|---------|
| `codeberg` | Orange on dark |
| `codeberg_light` | Orange on white |
| `github` | Green on dark (GitHub-style) |
| `github_light` | Green on white |

## Demo images

![Codeberg Activity — codeberg](https://codeberg-activity-graph.vercel.app/activity?user=willtonkin&theme=codeberg)
![Codeberg Activity — codeberg_light](https://codeberg-activity-graph.vercel.app/activity?user=willtonkin&theme=codeberg_light)
![Codeberg Activity — github](https://codeberg-activity-graph.vercel.app/activity?user=willtonkin&theme=github)
![Codeberg Activity — github_light](https://codeberg-activity-graph.vercel.app/activity?user=willtonkin&theme=github_light)

---

## Deploy

### Option A — Vercel (one-click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/willtonkin/codeberg-activity-graph)

### Option B — CLI (any Next.js host)

```bash
# 1. Clone the repo
git clone https://github.com/willtonkin/codeberg-activity-graph
cd codeberg-activity-graph

# 2. Install dependencies
npm install

# 3. Build + run
npm run build
npm start
```

---

## Usage

### Embed in your GitHub README

```markdown
![Codeberg Activity](https://your-deployment.vercel.app/activity?user=YOUR_USERNAME)
```

With a theme:
```markdown
![Codeberg Activity](https://your-deployment.vercel.app/activity?user=YOUR_USERNAME&theme=github)
```

### HTML

```html
<img src="https://your-deployment.vercel.app/activity?user=YOUR_USERNAME" alt="Codeberg Activity"/>
```

---

## API Reference

```
GET /activity?user=<username>[&theme=<theme>]
```

| Parameter | Required | Values | Default |
|-----------|----------|--------|---------|
| `user` | ✅ | Any Codeberg username | — |
| `theme` | ❌ | `codeberg` · `codeberg_light` · `github` · `github_light` | `codeberg` |

### Responses

| Status | Meaning |
|--------|---------|
| `200` | SVG image |
| `400` | Missing or invalid `user` parameter |
| `404` | User not found on Codeberg |
| `502` | Codeberg API error |

---

## How it works

1. Fetches `https://codeberg.org/api/v1/users/{username}/heatmap` (Gitea's built-in heatmap endpoint)
2. Transforms Unix timestamps → a 52-week Sunday-aligned grid
3. Renders a hand-crafted SVG with coloured cells, month labels, day labels, and a legend
4. Returns the SVG with `Cache-Control: public, max-age=3600`

---

## Local development

```bash
npm install
npm run dev
# → http://localhost:3000/activity?user=YOUR_USERNAME
```

---

## Project structure

```
codeberg-activity-graph/
├── app/
│   ├── activity/
│   │   └── route.js     ← Next.js App Router SVG route
│   ├── globals.css      ← Global styles
│   ├── layout.js        ← Root layout
│   └── page.jsx         ← Demo/preview page
└── package.json
```

---

## License

MIT
