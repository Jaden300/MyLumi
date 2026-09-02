"""Batched insights - the endpoint the app actually calls.

One request runs all three numeric models. On Render's free tier a cold start
costs ~50s, and paying that once beats paying it three times; it also guarantees
the three cards on the dashboard describe the same snapshot of the data.

The individual endpoints still exist for debugging and for the API docs, which
matter for the judges reading the Render architecture writeup.
"""

from fastapi import APIRouter

from ..models import anomaly as anomaly_model
from ..models import correlation as correlation_model
from ..models import forecast as forecast_model
from ..models.features import to_episodes
from ..schemas import InsightRequest, InsightsResponse

router = APIRouter(prefix="/v1", tags=["insights"])


@router.post("/insights", response_model=InsightsResponse)
def insights(request: InsightRequest) -> InsightsResponse:
    episodes = to_episodes(request.rows)
    return InsightsResponse(
        forecast=forecast_model.forecast(episodes),
        correlation=correlation_model.correlate(episodes),
        anomaly=anomaly_model.detect(episodes),
    )
