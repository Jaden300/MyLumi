from fastapi import APIRouter

from ..models import correlation as correlation_model
from ..models.features import to_episodes
from ..schemas import CorrelationResponse, InsightRequest

router = APIRouter(prefix="/v1", tags=["correlation"])


@router.post("/correlation", response_model=CorrelationResponse)
def correlation(request: InsightRequest) -> CorrelationResponse:
    return CorrelationResponse(**correlation_model.correlate(to_episodes(request.rows)))
