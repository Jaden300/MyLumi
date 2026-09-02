"""Journal sentiment.

Separate endpoint, separate request model, separate consent step in the UI. Free
text is the most sensitive content in the app and must never be sent as an
incidental side effect of a numeric call - which is why NlpRequest exists rather
than adding a `texts` field to InsightRequest.

Text is scored in-process and discarded. Nothing is written, nothing is logged.
"""

from fastapi import APIRouter

from ..models import nlp as nlp_model
from ..schemas import NlpRequest, NlpResponse

router = APIRouter(prefix="/v1", tags=["nlp"])


@router.post("/nlp", response_model=NlpResponse)
def nlp(request: NlpRequest) -> NlpResponse:
    return NlpResponse(**nlp_model.analyse(request.texts))
