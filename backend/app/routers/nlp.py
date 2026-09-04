"""Journal text - sentiment, writing change, and symptom mentions.

Separate endpoint, separate request model, separate consent step in the UI. Free
text is the most sensitive content in the app and must never be sent as an
incidental side effect of a numeric call - which is why NlpRequest exists rather
than adding a `texts` field to InsightRequest.

Text is scored in-process and discarded. Nothing is written, nothing is logged.

## Why the call is wrapped

This used to be a one-line pass-through, which was right when it called one
model. It now runs three, so the argument in routers/insights.py applies word for
word: an exception in the symptom extractor must not take down a sentiment card
that worked.

The shape differs from that router's `_section` because NlpResponse is ONE
envelope rather than six independent ones. So the degradation is asymmetric, and
deliberately so:

  - sentiment fails  -> the whole unavailable envelope. There is no useful
                        response without it; `mentions` alone is word counts
                        with nothing to attach them to.
  - mentions fail    -> `[]`, which is already what a user who wrote about no
                        symptoms receives. The client renders it today.
  - complexity fails -> `None`, likewise already a valid state.

Both soft failures degrade into states the client has always handled, so a bug
in either costs one paragraph rather than the card.

Nothing here logs the payload, not even on failure. That rule is stricter here
than on the numeric endpoint: a traceback carrying journal text is somebody's
private writing at rest on a server.
"""

from fastapi import APIRouter

from ..models import nlp as nlp_model
from ..schemas import NlpRequest, NlpResponse

router = APIRouter(prefix="/v1", tags=["nlp"])

UNAVAILABLE = "MyLumi could not read your journal entries right now."


@router.post("/nlp", response_model=NlpResponse)
def nlp(request: NlpRequest) -> NlpResponse:
    try:
        result = nlp_model.analyse(request.texts)
    except Exception:  # noqa: BLE001 - see docstring
        return NlpResponse(
            available=False,
            reason=UNAVAILABLE,
            confidence="none",
            nDays=0,
            points=[],
            trend=None,
            meanSentiment=None,
            mentions=[],
            complexity=None,
        )
    return NlpResponse(**result)
