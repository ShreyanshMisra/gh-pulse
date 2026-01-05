# GitHub Analyzer API

FastAPI backend service providing REST endpoints and WebSocket connections for the GitHub Activity Stream Analyzer.

## Endpoints

- `GET /api/trending` - Trending repositories
- `GET /api/languages` - Language statistics
- `GET /api/repos/{owner}/{repo}/metrics` - Repository metrics
- `GET /api/search` - Search repositories
- `WS /ws` - Real-time event stream
