from fastapi import APIRouter

from ..models import validation as validation_model
from ..models.features import to_episodes
from ..schemas import InsightRequest, ValidationResponse

router = APIRouter(prefix="/v1", tags=["validation"])


@router.post("/validation", response_model=ValidationResponse)
def validation(request: InsightRequest) -> ValidationResponse:
    return ValidationResponse(**validation_model.validate(to_episodes(request.rows)))
