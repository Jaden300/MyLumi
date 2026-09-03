from fastapi import APIRouter

from ..models import state as state_model
from ..models.features import to_episodes
from ..schemas import InsightRequest, RecoveryStateResponse

router = APIRouter(prefix="/v1", tags=["state"])


@router.post("/state", response_model=RecoveryStateResponse)
def state(request: InsightRequest) -> RecoveryStateResponse:
    return RecoveryStateResponse(**state_model.recovery_state(to_episodes(request.rows)))
