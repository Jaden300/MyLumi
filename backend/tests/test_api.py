"""Endpoint-level tests, including the privacy guarantees the architecture promises."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

from .fixtures import make_rows

client = TestClient(app)


def payload(n=30):
    return {"rows": [r.model_dump() for r in make_rows(n)], "daysSinceInjury": 20}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_advertises_statelessness():
    body = client.get("/").json()
    assert body["stateless"] is True
    assert body["storesData"] is False


def test_insights_batches_all_three_models():
    response = client.post("/v1/insights", json=payload())
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"forecast", "correlation", "anomaly"}
    assert body["forecast"]["available"] is True


@pytest.mark.parametrize("path", ["/v1/forecast", "/v1/correlation", "/v1/anomaly"])
def test_individual_endpoints_match_the_batched_call(path):
    single = client.post(path, json=payload()).json()
    batched = client.post("/v1/insights", json=payload()).json()[path.rsplit("/", 1)[1]]
    assert single == batched


@pytest.mark.parametrize(
    "path", ["/v1/insights", "/v1/forecast", "/v1/correlation", "/v1/anomaly"]
)
def test_empty_and_minimal_payloads_never_500(path):
    for body in ({"rows": []}, {"rows": [{"nightOf": "2026-01-01"}]}, {}):
        response = client.post(path, json=body)
        assert response.status_code == 200, f"{path} on {body} -> {response.status_code}"


def test_numeric_endpoints_reject_journal_text():
    """Free text must not be smuggled through a numeric call.

    Pydantic ignores unknown fields, so the guarantee is that the field simply
    has nowhere to land in FeatureRow - verified here so a future 'convenience'
    addition to the schema breaks a test.
    """
    from app.schemas import FeatureRow

    for banned in ("journal", "day", "factors", "wakeFeeling", "text", "notes"):
        assert banned not in FeatureRow.model_fields


def test_feature_row_carries_no_identifiers():
    from app.schemas import FeatureRow

    for banned in ("userId", "email", "name", "deviceId", "sessionId", "ip"):
        assert banned not in FeatureRow.model_fields


def test_nlp_endpoint_works_and_is_separate():
    days = ["an awful painful exhausting day", "a good clear rested day overall"]
    response = client.post(
        "/v1/nlp",
        json={
            "texts": [
                {"nightOf": f"2026-01-{i:02d}", "day": days[i % 2], "factors": "", "wakeFeeling": ""}
                # Enough entries to clear the threshold; sentiment is gated like
                # every other model.
                for i in range(1, 8)
            ]
        },
    )
    assert response.status_code == 200
    assert response.json()["available"] is True


def test_nlp_rejects_feature_rows():
    """The two payloads are deliberately incompatible shapes."""
    response = client.post("/v1/nlp", json=payload())
    assert response.json()["available"] is False


def test_cold_start_case_is_honest_end_to_end():
    """Three nights in: no numbers anywhere, and a reason for each."""
    body = client.post("/v1/insights", json={"rows": [r.model_dump() for r in make_rows(3)]}).json()
    assert body["forecast"]["predictedBurden"] is None
    assert body["correlation"]["findings"] == []
    assert body["anomaly"]["anomalies"] == []
    for section in body.values():
        assert section["available"] is False
        assert section["reason"]
