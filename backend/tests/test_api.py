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


def test_insights_batches_every_model():
    """One request, every numeric model - so a cold instance wakes once.

    Asserting the exact set rather than a subset on purpose: a section silently
    disappearing from this response is a frontend outage, because the UI reads
    each one directly.
    """
    response = client.post("/v1/insights", json=payload())
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "forecast",
        "correlation",
        "anomaly",
        "symptoms",
        "validation",
        "recoveryState",
    }
    assert body["forecast"]["available"] is True


def test_every_section_carries_the_standard_envelope():
    """The UI branches on these four keys for every card it renders."""
    body = client.post("/v1/insights", json=payload()).json()
    for name, section in body.items():
        for key in ("available", "reason", "confidence", "nDays"):
            assert key in section, f"{name} is missing {key}"


def test_one_failing_model_never_takes_down_the_others(monkeypatch):
    """Six models in one response is six chances to lose all six.

    A model that raises must degrade to its own unavailable envelope, not a 500
    that blanks every card on the screen.
    """
    from app.routers import insights as insights_router

    def explode(*_args, **_kwargs):
        raise RuntimeError("model blew up")

    monkeypatch.setattr(insights_router.symptoms_model, "analyse", explode)

    response = client.post("/v1/insights", json=payload())
    assert response.status_code == 200
    body = response.json()
    assert body["symptoms"]["available"] is False
    assert body["symptoms"]["reason"]
    # The rest still answered.
    assert body["forecast"]["available"] is True


@pytest.mark.parametrize(
    "path",
    ["/v1/forecast", "/v1/correlation", "/v1/anomaly", "/v1/symptoms", "/v1/validation"],
)
def test_individual_endpoints_match_the_batched_call(path):
    single = client.post(path, json=payload()).json()
    batched = client.post("/v1/insights", json=payload()).json()[path.rsplit("/", 1)[1]]
    assert single == batched


@pytest.mark.parametrize(
    "path",
    [
        "/v1/insights",
        "/v1/forecast",
        "/v1/correlation",
        "/v1/anomaly",
        "/v1/symptoms",
        "/v1/validation",
        "/v1/state",
    ],
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


def test_pain_crosses_the_wire_as_aggregates_only():
    """Where someone hurts arrives as three numbers, never as a region map.

    A column per body region would be nearly all null on every row, and a stable
    map of where a person aches week after week is closer to an identifier than
    a measurement. Pinned here so adding one later has to be deliberate.
    """
    from app.schemas import FeatureRow

    for field in ("painRegionCount", "painMax", "painMean"):
        assert field in FeatureRow.model_fields
        assert FeatureRow.model_fields[field].default is None

    for banned in ("painRegions", "regions", "pain_thigh_r", "painMap"):
        assert banned not in FeatureRow.model_fields


def test_pain_absence_and_emptiness_stay_distinct():
    """None means never asked; 0 regions means asked and nothing hurt.

    The asymmetry is deliberate: a count over an empty set is a real 0, but a
    maximum over one is undefined and must not arrive as 0.
    """
    from app.schemas import FeatureRow

    unasked = FeatureRow(nightOf="2026-01-01")
    assert unasked.painRegionCount is None
    assert unasked.painMax is None

    none_reported = FeatureRow(nightOf="2026-01-01", painRegionCount=0)
    assert none_reported.painRegionCount == 0
    assert none_reported.painMax is None


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


def test_nlp_survives_a_failing_secondary_model(monkeypatch):
    """A crash in the extractor must not take down a sentiment card that worked.

    The three models in this endpoint share one envelope, so the degradation is
    asymmetric by design: mentions and complexity fail soft into states the
    client already renders, rather than 500-ing the whole response.
    """
    from app.models.nlp import symptom_terms

    def boom(_entries):
        raise RuntimeError("shape the extractor did not expect")

    monkeypatch.setattr(symptom_terms, "mentions", boom)

    days = ["an awful painful exhausting day", "a good clear rested day overall"]
    response = client.post(
        "/v1/nlp",
        json={
            "texts": [
                {"nightOf": f"2026-01-{i:02d}", "day": days[i % 2]}
                for i in range(1, 8)
            ]
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert body["available"] is True      # sentiment survived
    assert body["mentions"] == []         # the failure degraded to a valid state


def test_nlp_response_carries_no_numeric_clinical_fields():
    """The response is the other half of the wire boundary.

    The request cannot carry symptom scores; this asserts the response does not
    hand any back either, so nothing about the numeric record can round-trip
    through the text endpoint.
    """
    response = client.post(
        "/v1/nlp",
        json={
            "texts": [
                {"nightOf": f"2026-01-{i:02d}", "day": "a rough painful tiring day"}
                for i in range(1, 8)
            ]
        },
    )
    serialised = response.text
    for banned in ("symptomBurden", "sleepQuality", "sleepDurationHours", "daysSinceInjury"):
        assert banned not in serialised


def test_extreme_but_finite_values_do_not_500():
    """A regression, found by probing rather than by the suite.

    The schema rejects inf/NaN at the boundary, so raw `Infinity` was already
    handled. Finite-but-huge passed validation and overflowed *inside* the
    anomaly model instead, producing a NaN score that FastAPI could not encode -
    so the service answered a well-formed request with a stack trace.

    Written against the raw body because `json.dumps` will not emit these values
    from a Python dict, which is what hid the shape during earlier testing.
    """
    rows = ",".join(
        f'{{"nightOf":"2026-04-{i + 1:02d}","symptomBurden":1e308,'
        f'"nextSymptomBurden":1e308,"sleepDurationMinutes":400,"sleepQuality":3}}'
        for i in range(14)
    )
    response = client.post(
        "/v1/insights",
        content='{"rows":[' + rows + '],"daysSinceInjury":14}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 200
    response.json()  # the actual failure was here, not in the status code


def test_unhandled_errors_never_echo_the_payload(monkeypatch):
    """The handler in main.py exists to keep clinical data out of the logs and
    out of the error body. A 500 must say nothing about what it was given."""
    from app.routers import insights as insights_router

    def explode(*args, **kwargs):
        raise RuntimeError("symptomBurden=54 headache=6 secret clinical detail")

    monkeypatch.setattr(insights_router, "to_episodes", explode)

    unraising = TestClient(app, raise_server_exceptions=False)
    response = unraising.post("/v1/insights", json=payload())

    assert response.status_code == 500
    body = response.text
    assert "secret clinical detail" not in body
    assert "symptomBurden=54" not in body
    assert "Traceback" not in body
    assert response.json()["available"] is False
