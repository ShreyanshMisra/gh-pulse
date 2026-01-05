# GitHub Activity Stream Analyzer

A real-time data pipeline that ingests GitHub's public event stream, processes events, and surfaces actionable insights about trending repositories and emerging technologies. Think of it as a "Bloomberg Terminal for GitHub" - providing early signals about what's happening in the open source ecosystem.

## Features

- **Real-Time Ingestion** - Polls GitHub Events API every 10 seconds with intelligent token rotation
- **Stream Processing** - Kafka-based pipeline with batch processing to PostgreSQL
- **Trend Detection** - Velocity score algorithm identifies repos gaining momentum
- **Live Dashboard** - Next.js frontend with real-time updates via SWR
- **Language Analytics** - Track trends by programming language
- **Time Windows** - Analyze trends across 1h, 6h, 24h, 7d, and 30d windows

## Architecture

```
  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
  │   GitHub    │      │    Kafka    │      │  Processor  │      │ PostgreSQL  │
  │  Events API │─────▶│   (Queue)   │─────▶│  (Consumer) │─────▶│    (DB)     │
  └─────────────┘      └─────────────┘      └─────────────┘      └──────┬──────┘
        │                                                                │
        │ Poll every 10s                                                 │
        │ Token rotation                                                 │
        │ ETag caching                          ┌────────────────────────┘
                                                │
                                                ▼
  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
  │   Next.js   │◀─────│   FastAPI   │◀─────│    Redis    │
  │  Dashboard  │      │     API     │      │   (Cache)   │
  └─────────────┘      └─────────────┘      └─────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Ingestion | Python, kafka-python |
| Processing | Python, psycopg2, Redis |
| API | FastAPI, SQLAlchemy, asyncpg |
| Search | Elasticsearch 8.x |
| Database | PostgreSQL 16 |
| Queue | Apache Kafka |
| Cache | Redis |
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- GitHub Personal Access Token(s)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/github-analyzer.git
   cd github-analyzer
   ```

2. Create a `.env` file with your GitHub token(s):
   ```bash
   GITHUB_TOKENS=ghp_your_token_here
   ```

3. Start all services:
   ```bash
   docker-compose up -d
   ```

4. Access the dashboard at http://localhost:3000

### Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js dashboard |
| API | 8000 | FastAPI backend |
| Kafka | 9092, 9094 | Message broker |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache layer |
| Elasticsearch | 9200 | Search engine |

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
| `GET /api/repos/{owner}/{repo}/metrics` | Metrics for a specific repository |
| `GET /api/search` | Search repositories |
| `WS /ws` | WebSocket for real-time updates |

## Project Structure

```
github-analyzer/
├── services/
│   ├── api/          # FastAPI backend
│   ├── ingestion/    # GitHub Events API poller
│   └── processor/    # Kafka consumer & data processor
├── frontend/         # Next.js dashboard
├── scripts/          # Database initialization
└── docker-compose.yml
```

## Development

### Running Locally

Start infrastructure services:
```bash
docker-compose up -d kafka postgres redis elasticsearch
```

Run individual services for development:
```bash
# API
cd services/api && pip install -e . && python -m src.main

# Ingestion
cd services/ingestion && pip install -e . && python -m src.main

# Processor
cd services/processor && pip install -e . && python -m src.main

# Frontend
cd frontend && npm install && npm run dev
```

## License

MIT
