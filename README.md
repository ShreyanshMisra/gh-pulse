# GitHub Activity Stream Analyzer

A real-time data pipeline that ingests GitHub's public event stream, processes events, and surfaces actionable insights about trending repositories and emerging technologies. Think of it as a "Bloomberg Terminal for GitHub" - providing early signals about what's happening in the open source ecosystem.

## Features

- **Scheduled Ingestion** - GitHub Actions fetches events every 15 minutes
- **Trend Detection** - Velocity score algorithm identifies repos gaining momentum
- **Live Dashboard** - Next.js frontend with automatic data refresh
- **Language Analytics** - Track trends by programming language
- **Time Windows** - Analyze trends across 1h, 6h, 24h, 7d, and 30d windows
- **100% Free Hosting** - Runs entirely on Vercel + Neon free tiers

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GITHUB ACTIONS (Free)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Scheduled Workflow (every 15 min)                      │   │
│  │  - Fetch GitHub Events API                              │   │
│  │  - Calculate velocity scores                            │   │
│  │  - Write to PostgreSQL                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VERCEL (Free)                              │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │   Next.js   │ ───▶ │  API Routes │ ◀─── │  PostgreSQL │     │
│  │  Frontend   │      │ (Serverless)│      │   (Neon)    │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| API | Next.js API Routes (Serverless) |
| Database | PostgreSQL (Neon) |
| Ingestion | GitHub Actions + Python |
| Hosting | Vercel (Free) |

## Deployment (100% Free)

### Step 1: Create a Neon Database

1. Sign up at [neon.tech](https://neon.tech) (free tier)
2. Create a new project
3. Copy your connection string (looks like `postgresql://user:pass@host/db`)
4. Run the database schema:
   ```sql
   -- Copy contents from scripts/init-db.sql
   ```

### Step 2: Deploy to Vercel

1. Fork this repository to your GitHub account
2. Go to [vercel.com](https://vercel.com) and click **Import Project**
3. Select your forked repository
4. Set the **Root Directory** to `frontend`
5. Add environment variable:
   ```
   DATABASE_URL=postgresql://user:pass@host/db
   ```
6. Click **Deploy**

### Step 3: Set Up GitHub Actions

1. In your forked repo, go to **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `GH_EVENTS_TOKEN`: A GitHub Personal Access Token (create at github.com/settings/tokens)
   - `DATABASE_URL`: Your Neon connection string
3. The workflow runs automatically every 15 minutes

### That's it! 🎉

Your dashboard will be live at `https://your-project.vercel.app`

## Local Development

### Using Docker (Full Stack)

```bash
# Start all services
docker-compose up -d

# Access dashboard at http://localhost:3000
```

### Frontend Only

```bash
cd frontend
npm install
npm run dev
```

## Velocity Score Algorithm

The velocity score identifies repositories gaining momentum relative to their size:

```python
velocity = base_weight * size_factor * 10

where:
  base_weight = event_type_weight  # Stars=1.0, Forks=0.8, PRs=0.6, etc.
  size_factor = 1 / log(total_stars + 1)  # Smaller repos score higher
```

This rewards:
- Star events over other activity types
- Smaller repositories showing unusual growth (potential breakout projects)
- Recent momentum over historical popularity

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/trending` | Top trending repositories |
| `GET /api/languages` | Language statistics and trends |
| `GET /api/stats` | Real-time statistics |

## Project Structure

```
github-analyzer/
├── frontend/              # Next.js app (deploy this to Vercel)
│   ├── app/
│   │   ├── api/          # Serverless API routes
│   │   └── ...           # Pages
│   └── components/
├── scripts/
│   ├── init-db.sql       # Database schema
│   └── ingest_events.py  # GitHub Actions ingestion script
├── .github/workflows/
│   └── ingest.yml        # Scheduled ingestion workflow
└── docker-compose.yml    # Local development
```

## Cost Summary

| Service | Provider | Cost |
|---------|----------|------|
| Frontend + API | Vercel | **Free** |
| Database | Neon | **Free** (0.5 GB) |
| Ingestion | GitHub Actions | **Free** (2000 min/month) |
| **Total** | | **$0/month** |

## License

MIT
