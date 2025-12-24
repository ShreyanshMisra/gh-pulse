# GitHub Activity Stream Analyzer

"Bloomberg Terminal for GitHub" providing early signals about what's happening in the open source ecosystem before it hits the front page. It's a real-time data pipeline that ingests GitHub's public event stream, processes millions of events, and surfaces actionable insights about trending repositories and emerging technologies.


## Key Features

- **Real-Time Ingestion** - Polls GitHub Events API every 10 seconds with intelligent token rotation
- **Stream Processing** - Kafka-based pipeline with batch processing to PostgreSQL
- **Trend Detection** - Velocity score algorithm identifies repos gaining momentum
- **Interactive Dashboard** - Next.js frontend with live data updates via SWR
- **Multi-Language Filtering** - Track trends by programming language
- **Time Window Analysis** - Analyze trends across 1h, 6h, 24h, 7d, and 30d windows

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        GitHub Activity Stream Analyzer                    │
└──────────────────────────────────────────────────────────────────────────┘

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
        │
        │ SWR (30s refresh)
        ▼
   ┌──────────┐
   │  Browser │
   └──────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Ingestion** | Python 3.11+, kafka-python, requests |
| **Message Queue** | Apache Kafka (Bitnami) |
| **Stream Processing** | Python consumer with batch writes |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Search** | Elasticsearch 8.11 |
| **API** | FastAPI, SQLAlchemy (async), asyncpg |
| **Frontend** | Next.js 14, TailwindCSS, SWR, Recharts |
| **Infrastructure** | Docker Compose |

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2.0+
- [GitHub Personal Access Token](https://github.com/settings/tokens) (one or more for rate limit rotation)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/github-analyzer.git
cd github-analyzer
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your GitHub token(s):

```env
GITHUB_TOKENS=ghp_your_token_here
```

> **Tip:** Use multiple comma-separated tokens to increase rate limits (5,000 requests/hour per token).

### 3. Start All Services

```bash
docker compose up -d
```

### 4. Access the Application

| Service | URL |
|---------|-----|
| **Dashboard** | http://localhost:3000 |
| **API Docs** | http://localhost:8000/docs |
| **Health Check** | http://localhost:8000/health |

## API Reference

### Get Trending Repositories

```http
GET /api/trending?language=python&window=24h&limit=50
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `language` | string | - | Filter by programming language |
| `window` | string | `24h` | Time window: `1h`, `6h`, `12h`, `24h`, `7d`, `30d` |
| `limit` | int | `50` | Number of results (max 100) |

**Response:**

```json
{
  "data": [
    {
      "repo_id": 123456,
      "repo_name": "owner/repo",
      "language": "Python",
      "description": "A cool project",
      "total_stars": 1500,
      "stars_gained": 42,
      "velocity_score": 2.3456,
      "event_count": 128
    }
  ],
  "window": "24h",
  "timestamp": "2024-01-15T10:30:00Z",
  "total": 50
}
```

### Get Repository Metrics

```http
GET /api/repos/{owner}/{repo}/metrics?window=24h
```

### Get Language Statistics

```http
GET /api/languages?window=24h&limit=20
```

## How It Works

### Velocity Score Algorithm

The velocity score identifies repositories gaining momentum relative to their size:

```python
velocity = base_weight × size_factor × 10

where:
  base_weight = event_type_weight  # Stars=1.0, Forks=0.8, PRs=0.6, etc.
  size_factor = 1 / log(total_stars + 1)  # Smaller repos score higher
```

This rewards:
- **Star events** over other activity types
- **Smaller repositories** showing unusual growth (potential breakout projects)
- **Recent momentum** over historical popularity

### Data Pipeline Flow

1. **Ingestion Service** polls GitHub Events API every 10 seconds
2. Events are published to Kafka topic `github-events-raw`
3. **Processor Service** consumes events in batches
4. Velocity scores are calculated and data is written to PostgreSQL
5. **API Service** queries PostgreSQL and serves data to the frontend
6. **Frontend** polls API every 30 seconds via SWR

## Development

### Running Locally (Without Docker)

```bash
# Terminal 1: Start infrastructure
docker compose up -d kafka postgres redis elasticsearch

# Terminal 2: Ingestion service
cd services/ingestion
pip install -e .
python -m src.main

# Terminal 3: Processor service
cd services/processor
pip install -e .
python -m src.main

# Terminal 4: API service
cd services/api
pip install -e .
uvicorn src.main:app --reload --port 8000

# Terminal 5: Frontend
cd frontend
npm install
npm run dev
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f processor
```

### Kafka Topic Inspection

```bash
# List topics
docker compose exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list

# View messages
docker compose exec kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic github-events-raw \
  --from-beginning
```
