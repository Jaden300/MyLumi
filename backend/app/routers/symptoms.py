from fastapi import APIRouter

from ..models import symptoms as symptoms_model
from ..models.features import to_episodes
from ..schemas import InsightRequest, SymptomsResponse

router = APIRouter(prefix="/v1", tags=["symptoms"])


@router.post("/symptoms", response_model=SymptomsResponse)
def symptoms(request: InsightRequest) -> SymptomsResponse:
    return SymptomsResponse(**symptoms_model.analyse(to_episodes(request.rows)))
