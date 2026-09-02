from fastapi import APIRouter

from ..models import anomaly as anomaly_model
from ..models.features import to_episodes
from ..schemas import AnomalyResponse, InsightRequest

router = APIRouter(prefix="/v1", tags=["anomaly"])


@router.post("/anomaly", response_model=AnomalyResponse)
def anomaly(request: InsightRequest) -> AnomalyResponse:
    return AnomalyResponse(**anomaly_model.detect(to_episodes(request.rows)))
