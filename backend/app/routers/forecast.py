from fastapi import APIRouter

from ..models import forecast as forecast_model
from ..models import validation as validation_model
from ..models.features import to_episodes
from ..schemas import ForecastResponse, InsightRequest

router = APIRouter(prefix="/v1", tags=["forecast"])


@router.post("/forecast", response_model=ForecastResponse)
def forecast(request: InsightRequest) -> ForecastResponse:
    episodes = to_episodes(request.rows)
    # Same conformal half-width the batched endpoint uses. A test asserts the
    # two responses match exactly, and more importantly a debug endpoint that
    # reported a different interval from the one users see would be worse than
    # having no debug endpoint.
    half_width = validation_model.conformal_half_width(episodes)
    return ForecastResponse(
        **forecast_model.forecast(episodes, interval_half_width=half_width)
    )
