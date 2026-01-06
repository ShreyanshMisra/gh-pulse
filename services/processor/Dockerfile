FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (needed for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast package management
RUN pip install --no-cache-dir uv

# Copy and install shared package first
COPY shared/ /app/shared/
RUN uv pip install --system -e /app/shared

# Copy dependency files
COPY processor/pyproject.toml processor/README.md ./

# Install dependencies
RUN uv pip install --system -e .

# Copy source code
COPY processor/src/ ./src/

# Set Python path
ENV PYTHONPATH=/app

# Run the service
CMD ["python", "-m", "src.main"]
