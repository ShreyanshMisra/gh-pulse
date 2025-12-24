#!/bin/bash

# GitHub Activity Stream Analyzer - Development Startup Script
# This script starts all services for local development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}GitHub Activity Stream Analyzer${NC}"
echo -e "${BLUE}Development Environment Setup${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check for required tools
check_requirements() {
    echo -e "${YELLOW}Checking requirements...${NC}"

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}Error: Docker Compose is not installed${NC}"
        exit 1
    fi

    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}Warning: Node.js is not installed. Frontend won't run locally.${NC}"
    fi

    if ! command -v python3 &> /dev/null; then
        echo -e "${YELLOW}Warning: Python 3 is not installed. Services won't run locally.${NC}"
    fi

    echo -e "${GREEN}Requirements check passed!${NC}"
    echo ""
}

# Copy environment file if it doesn't exist
setup_env() {
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        echo -e "${YELLOW}Please update .env with your GitHub tokens!${NC}"
        echo ""
    fi
}

# Start infrastructure services
start_infrastructure() {
    echo -e "${BLUE}Starting infrastructure services...${NC}"
    cd "$PROJECT_ROOT"

    # Use docker compose (v2) or docker-compose (v1)
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    $COMPOSE_CMD up -d kafka postgres redis elasticsearch

    echo -e "${GREEN}Infrastructure services started!${NC}"
    echo ""

    # Wait for services to be healthy
    echo -e "${YELLOW}Waiting for services to be ready...${NC}"
    sleep 10

    # Check service health
    echo "Checking Kafka..."
    $COMPOSE_CMD exec -T kafka kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null || echo "Kafka is still starting..."

    echo "Checking PostgreSQL..."
    $COMPOSE_CMD exec -T postgres pg_isready -U postgres 2>/dev/null || echo "PostgreSQL is still starting..."

    echo "Checking Redis..."
    $COMPOSE_CMD exec -T redis redis-cli ping 2>/dev/null || echo "Redis is still starting..."

    echo "Checking Elasticsearch..."
    curl -s http://localhost:9200/_cluster/health 2>/dev/null | head -c 100 || echo "Elasticsearch is still starting..."

    echo ""
    echo -e "${GREEN}Infrastructure is ready!${NC}"
    echo ""
}

# Create Kafka topics
create_kafka_topics() {
    echo -e "${BLUE}Creating Kafka topics...${NC}"
    cd "$PROJECT_ROOT"

    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # Create topics
    $COMPOSE_CMD exec -T kafka kafka-topics.sh \
        --bootstrap-server localhost:9092 \
        --create --if-not-exists \
        --topic github-events-raw \
        --partitions 10 \
        --replication-factor 1 2>/dev/null || true

    $COMPOSE_CMD exec -T kafka kafka-topics.sh \
        --bootstrap-server localhost:9092 \
        --create --if-not-exists \
        --topic github-events-enriched \
        --partitions 10 \
        --replication-factor 1 2>/dev/null || true

    echo -e "${GREEN}Kafka topics created!${NC}"
    echo ""
}

# Print service URLs
print_urls() {
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}Services are running!${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    echo -e "Infrastructure:"
    echo -e "  Kafka:         ${BLUE}localhost:9094${NC} (external)"
    echo -e "  PostgreSQL:    ${BLUE}localhost:5432${NC}"
    echo -e "  Redis:         ${BLUE}localhost:6379${NC}"
    echo -e "  Elasticsearch: ${BLUE}http://localhost:9200${NC}"
    echo ""
    echo -e "To start services locally:"
    echo -e "  ${YELLOW}Ingestion:${NC}"
    echo -e "    cd services/ingestion && uv pip install -e . && python -m src.main"
    echo ""
    echo -e "  ${YELLOW}API:${NC}"
    echo -e "    cd services/api && uv pip install -e . && uvicorn src.main:app --reload"
    echo ""
    echo -e "  ${YELLOW}Frontend:${NC}"
    echo -e "    cd frontend && npm install && npm run dev"
    echo ""
    echo -e "Or start all services with Docker:"
    echo -e "    docker compose up -d"
    echo ""
    echo -e "View logs:"
    echo -e "    docker compose logs -f [service-name]"
    echo ""
    echo -e "Stop all services:"
    echo -e "    docker compose down"
    echo ""
}

# Main execution
main() {
    check_requirements
    setup_env
    start_infrastructure
    create_kafka_topics
    print_urls
}

# Run main function
main "$@"
