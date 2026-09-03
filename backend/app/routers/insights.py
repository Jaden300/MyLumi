"""Batched insights - the endpoint the app actually calls.

One request runs every numeric model. On Render's free tier a cold start costs
~50s, and paying that once beats paying it six times; it also guarantees the
cards on a screen all describe the same snapshot of the data.

The individual endpoints still exist for debugging and for the API docs, which
matter for the judges reading the Render architecture writeup.

## Why every model call is wrapped

Six models in one response means six chances for one of them to raise and take
the whole batch down with it - including the five that worked. A user would see
every card vanish because one model met a shape of data it did not expect.

So each is called through `_section`, which turns an unexpected failure into
that model's own "unavailable" envelope. This is the same principle the response
envelope already encodes: not being able to say something is a normal answer,
not an error. It applies just as much when the reason is a bug as when the
reason is thin data.

The exception is deliberate: nothing here logs the payload, not even on failure.
A traceback containing symptom scores is clinical data at rest on a server.
"""

from fastapi import APIRouter

from ..models import anomaly as anomaly_model
from ..models import correlation as correlation_model
from ..models import forecast as forecast_model
from ..models import state as state_model
from ..models import symptoms as symptoms_model
from ..models import validation as validation_model
from ..models.features import to_episodes
from ..schemas import InsightRequest, InsightsResponse

router = APIRouter(prefix="/v1", tags=["insights"])

UNAVAILABLE = "MyLumi could not work this out from your nights right now."


def _section(fn, episodes, **extra) -> dict:
    """Run one model, or return its unavailable envelope.

    Deliberately catches broadly. The alternative to a bare except here is a
    500 that removes every other insight from the screen, and a model that
    cannot answer is a state this API already models as a valid 200.
    """
    try:
        return fn(episodes, **extra)
    except Exception:  # noqa: BLE001 - see docstring
        return {
            "available": False,
            "reason": UNAVAILABLE,
            "confidence": "none",
            "nDays": 0,
        }


@router.post("/insights", response_model=InsightsResponse)
def insights(request: InsightRequest) -> InsightsResponse:
    episodes = to_episodes(request.rows)

    # The interval on the forecast comes from the validation model's
    # out-of-sample errors, so the band a user sees and the accuracy figure
    # beside it are the same measurement rather than two that could disagree.
    try:
        half_width = validation_model.conformal_half_width(episodes)
    except Exception:  # noqa: BLE001
        half_width = None

    return InsightsResponse(
        forecast=_section(
            forecast_model.forecast, episodes, interval_half_width=half_width
        ),
        correlation=_section(correlation_model.correlate, episodes),
        anomaly=_section(anomaly_model.detect, episodes),
        symptoms=_section(symptoms_model.analyse, episodes),
        validation=_section(validation_model.validate, episodes),
        recoveryState=_section(state_model.recovery_state, episodes),
    )
