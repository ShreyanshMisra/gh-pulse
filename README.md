# GitHub Activity Stream Analyzer

A "Bloomberg Terminal for GitHub" providing early signals about what's happening in the open source ecosystem before it hits the front page. Uses a real-time data pipeline that ingests GitHub's public event stream, processes millions of events, and surfaces actionable insights about trending repositories and emerging technologies. 

## Features

- Continuously polls the GitHub Events API with intelligent rate limit handling and token rotation
- Proprietary velocity score algorithm identifies repositories gaining momentum relative to their size
- Real-time visualization of trending repos, language analytics, and activity metrics
- Analyze trends across multiple time horizons: 1h, 6h, 24h, 7d, and 30d
- Track which programming languages and frameworks are gaining real traction

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts, SWR |
| API | Next.js API Routes, Serverless Functions |
| Database | PostgreSQL with time-series optimizations |
| Ingestion | Python, GitHub REST API |
| Infrastructure | Vercel, Neon, GitHub Actions |

## Velocity Score Algorithm

The velocity score is designed to surface repositories that are gaining unusual momentum, particularly favoring smaller projects showing breakout potential over already-popular repositories.

```
velocity = base_weight × size_factor × 10
```

| Component | Formula | Purpose |
|-----------|---------|---------|
| `base_weight` | Event type weight (Stars: 1.0, Forks: 0.8, PRs: 0.6, Commits: 0.3) | Prioritizes high-signal events |
| `size_factor` | `1 / log(total_stars + 1)` | Normalizes for repository size |

This rewards:
- **High-value events** — Star events indicate genuine interest over routine commits
- **Emerging projects** — Smaller repositories score higher for equivalent activity
- **Recent momentum** — Captures acceleration rather than absolute popularity
