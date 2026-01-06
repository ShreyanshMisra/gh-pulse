"""Search API endpoints using Elasticsearch."""

import logging
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from elasticsearch import AsyncElasticsearch, NotFoundError

from ..config import get_settings
from ..cache import cache_get, cache_set, make_cache_key, CacheTTL

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["search"])

# Global Elasticsearch client
_es_client: AsyncElasticsearch | None = None

# Index name for repositories
REPO_INDEX = "github-repos"


async def init_elasticsearch() -> None:
    """Initialize Elasticsearch client."""
    global _es_client

    settings = get_settings()
    try:
        _es_client = AsyncElasticsearch(
            hosts=[settings.elasticsearch_url],
            retry_on_timeout=True,
            max_retries=3,
        )
        # Test connection
        info = await _es_client.info()
        logger.info(f"Elasticsearch connected: {info['version']['number']}")

        # Ensure index exists
        await _ensure_index()
    except Exception as e:
        logger.warning(f"Elasticsearch connection failed: {e}. Search disabled.")
        _es_client = None


async def close_elasticsearch() -> None:
    """Close Elasticsearch client."""
    global _es_client

    if _es_client:
        await _es_client.close()
        _es_client = None
    logger.info("Elasticsearch connection closed")


async def _ensure_index() -> None:
    """Ensure the repository index exists with proper mappings."""
    if not _es_client:
        return

    try:
        exists = await _es_client.indices.exists(index=REPO_INDEX)
        if not exists:
            # Create index with mappings
            await _es_client.indices.create(
                index=REPO_INDEX,
                body={
                    "settings": {
                        "number_of_shards": 1,
                        "number_of_replicas": 0,
                        "analysis": {
                            "analyzer": {
                                "repo_analyzer": {
                                    "type": "custom",
                                    "tokenizer": "standard",
                                    "filter": ["lowercase", "asciifolding"],
                                }
                            }
                        }
                    },
                    "mappings": {
                        "properties": {
                            "repo_id": {"type": "long"},
                            "full_name": {
                                "type": "text",
                                "analyzer": "repo_analyzer",
                                "fields": {
                                    "keyword": {"type": "keyword"}
                                }
                            },
                            "description": {
                                "type": "text",
                                "analyzer": "repo_analyzer",
                            },
                            "language": {"type": "keyword"},
                            "total_stars": {"type": "integer"},
                            "velocity_score": {"type": "float"},
                            "last_updated": {"type": "date"},
                        }
                    }
                }
            )
            logger.info(f"Created Elasticsearch index: {REPO_INDEX}")
    except Exception as e:
        logger.error(f"Failed to create index: {e}")


async def index_repository(
    repo_id: int,
    full_name: str,
    description: str | None,
    language: str | None,
    total_stars: int,
    velocity_score: float,
) -> bool:
    """Index a repository in Elasticsearch.

    Args:
        repo_id: GitHub repository ID
        full_name: Full repository name (owner/repo)
        description: Repository description
        language: Primary programming language
        total_stars: Total star count
        velocity_score: Current velocity score

    Returns:
        True if indexed successfully
    """
    if not _es_client:
        return False

    try:
        await _es_client.index(
            index=REPO_INDEX,
            id=str(repo_id),
            document={
                "repo_id": repo_id,
                "full_name": full_name,
                "description": description or "",
                "language": language,
                "total_stars": total_stars,
                "velocity_score": velocity_score,
                "last_updated": datetime.utcnow().isoformat(),
            },
        )
        return True
    except Exception as e:
        logger.error(f"Failed to index repository {full_name}: {e}")
        return False


class SearchResult(BaseModel):
    """Search result model."""

    repo_id: int
    full_name: str
    description: str | None
    language: str | None
    total_stars: int
    forks: int = 0  # Fork count (not stored, default to 0)
    velocity_score: float
    score: float  # Search relevance score
    owner: dict | None = None  # Optional owner info
    updated_at: str | None = None  # Last update timestamp


class SearchResponse(BaseModel):
    """Search response model."""

    query: str
    results: list[SearchResult]
    total: int
    took_ms: int


@router.get("/search", response_model=SearchResponse)
async def search_repositories(
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    language: str | None = Query(None, description="Filter by language"),
    sort: Literal["relevance", "stars", "velocity"] = Query(
        "relevance", description="Sort order"
    ),
    limit: int = Query(20, ge=1, le=100, description="Number of results"),
) -> SearchResponse:
    """Search repositories by name or description.

    Full-text search with optional language filter and sorting.
    """
    if not _es_client:
        raise HTTPException(
            status_code=503,
            detail="Search service unavailable. Elasticsearch not connected.",
        )

    # Check cache
    cache_key = make_cache_key("search", q, language or "", sort, str(limit))
    cached = await cache_get(cache_key)
    if cached:
        return SearchResponse(**cached)

    try:
        # Build query
        must_clauses = [
            {
                "multi_match": {
                    "query": q,
                    "fields": ["full_name^3", "description"],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            }
        ]

        filter_clauses = []
        if language:
            filter_clauses.append({"term": {"language": language}})

        # Build sort
        sort_config = []
        if sort == "stars":
            sort_config = [{"total_stars": {"order": "desc"}}, "_score"]
        elif sort == "velocity":
            sort_config = [{"velocity_score": {"order": "desc"}}, "_score"]
        else:
            sort_config = ["_score", {"total_stars": {"order": "desc"}}]

        # Execute search
        response = await _es_client.search(
            index=REPO_INDEX,
            body={
                "query": {
                    "bool": {
                        "must": must_clauses,
                        "filter": filter_clauses,
                    }
                },
                "sort": sort_config,
                "size": limit,
            },
        )

        # Parse results
        hits = response["hits"]["hits"]
        results = [
            SearchResult(
                repo_id=hit["_source"]["repo_id"],
                full_name=hit["_source"]["full_name"],
                description=hit["_source"].get("description"),
                language=hit["_source"].get("language"),
                total_stars=hit["_source"].get("total_stars", 0),
                velocity_score=hit["_source"].get("velocity_score", 0.0),
                score=hit["_score"] or 0.0,
            )
            for hit in hits
        ]

        result = SearchResponse(
            query=q,
            results=results,
            total=response["hits"]["total"]["value"],
            took_ms=response["took"],
        )

        # Cache result
        await cache_set(cache_key, result.model_dump(), CacheTTL.SEARCH)

        return result

    except NotFoundError:
        return SearchResponse(query=q, results=[], total=0, took_ms=0)
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/search/suggest")
async def search_suggestions(
    q: str = Query(..., min_length=1, max_length=100, description="Partial query"),
    limit: int = Query(5, ge=1, le=10, description="Number of suggestions"),
) -> dict:
    """Get search suggestions (autocomplete).

    Returns repository names that match the partial query.
    """
    if not _es_client:
        return {"suggestions": []}

    try:
        response = await _es_client.search(
            index=REPO_INDEX,
            body={
                "query": {
                    "prefix": {
                        "full_name.keyword": {
                            "value": q.lower(),
                            "case_insensitive": True,
                        }
                    }
                },
                "size": limit,
                "_source": ["full_name", "language", "total_stars"],
                "sort": [{"total_stars": {"order": "desc"}}],
            },
        )

        suggestions = [
            {
                "name": hit["_source"]["full_name"],
                "language": hit["_source"].get("language"),
                "stars": hit["_source"].get("total_stars", 0),
            }
            for hit in response["hits"]["hits"]
        ]

        return {"suggestions": suggestions}

    except Exception as e:
        logger.warning(f"Suggestion error: {e}")
        return {"suggestions": []}
