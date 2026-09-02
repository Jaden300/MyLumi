from fastapi import APIRouter

from ..models import forecast as forecast_model
from ..models.features import to_episodes
from ..schemas import ForecastResponse, InsightRequest

router = APIRouter(prefix="/v1", tags=["forecast"])


@router.post("/forecast", response_model=ForecastResponse)
def forecast(request: InsightRequest) -> ForecastResponse:
    return ForecastResponse(**forecast_model.forecast(to_episodes(request.rows)))
