# GitHub Activity Stream Analyzer

"Bloomberg Terminal for GitHub" providing early signals about what's happening in the open source ecosystem before it hits the front page. It's a real-time data pipeline that ingests GitHub's public event stream, processes millions of events, and surfaces actionable insights about trending repositories and emerging technologies.


## Key Features

- Polls GitHub Events API every 10 seconds with intelligent token rotation
- Kafka-based pipeline with batch processing to PostgreSQL
- Velocity score algorithm identifies repos gaining momentum
- Next.js frontend with live data updates via SWR
- Track trends by programming language
- Analyze trends across 1h, 6h, 24h, 7d, and 30d windows

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
        │
        │ SWR (30s refresh)
        ▼
   ┌──────────┐
   │  Browser │
   └──────────┘
```

### Velocity Score Algorithm

The velocity score identifies repositories gaining momentum relative to their size:

```python
velocity = base_weight × size_factor × 10

where:
  base_weight = event_type_weight  # Stars=1.0, Forks=0.8, PRs=0.6, etc.
  size_factor = 1 / log(total_stars + 1)  # Smaller repos score higher
```

This rewards:
- Star events over other activity types
- Smaller repositories showing unusual growth (potential breakout projects)
- Recent momentum over historical popularity