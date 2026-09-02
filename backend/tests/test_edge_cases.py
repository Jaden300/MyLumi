"""Hostile and degenerate payloads.

The existing suites check that the models are correct on reasonable data. These
check that nothing reaches numpy that should not, and that the service answers
200 with an honest "unavailable" rather than a 500 or, worse, a fabricated
number, whatever it is sent.
"""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ENDPOINTS = ["/v1/insights", "/v1/forecast", "/v1/correlation", "/v1/anomaly"]


def row(i, burden=20.0, sleep=420.0):
    return {
        "nightOf": f"2026-01-{i:02d}",
        "symptomBurden": burden,
        "sleepDurationMinutes": sleep,
        "sleepQuality": 3.0,
        "mood": 50.0,
        "awakenings": 1.0,
        "moodMorning": 50.0,
    }


def rows(n, **kw):
    return [row(i, **kw) for i in range(1, n + 1)]


class TestDegenerateData:
    @pytest.mark.parametrize("path", ENDPOINTS)
    @pytest.mark.parametrize(
        "payload",
        [
            {},
            {"rows": []},
            {"rows": [row(1)]},
            {"rows": rows(20)},  # zero variance in every column
            {"rows": [{"nightOf": "2026-01-01"}] * 20},  # every feature missing
        ],
        ids=["empty-body", "no-rows", "one-row", "zero-variance", "all-null"],
    )
    def test_never_500s(self, path, payload):
        assert client.post(path, json=payload).status_code == 200

    def test_zero_variance_emits_no_number(self):
        """Identical values every night carry no signal, so there is nothing to say."""
        body = client.post("/v1/insights", json={"rows": rows(20)}).json()
        assert body["forecast"]["available"] is False
        assert body["forecast"]["predictedBurden"] is None

    @pytest.mark.parametrize("days", [-5, 0, 99999])
    def test_absurd_days_since_injury_is_survivable(self, days):
        r = client.post("/v1/insights", json={"rows": rows(20), "daysSinceInjury": days})
        assert r.status_code == 200


class TestNonFiniteNumbers:
    """NaN and Infinity are valid JSON literals to Python's parser, so they
    arrive as real floats. They must not survive into a model."""

    @pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity"])
    def test_rejected_at_the_boundary(self, literal):
        raw = '{"rows":[{"nightOf":"2026-01-01","symptomBurden":%s}]}' % literal
        r = client.post(
            "/v1/insights", content=raw, headers={"Content-Type": "application/json"}
        )
        assert r.status_code == 200
        # Dropped to null rather than carried through as a float.
        assert "NaN" not in r.text
        assert "Infinity" not in r.text

    def test_response_is_always_strict_json(self):
        """A NaN reaching the response would emit invalid JSON that many clients
        refuse to parse at all."""
        raw = json.dumps({"rows": rows(20)}).replace('"symptomBurden": 20.0', '"symptomBurden": NaN')
        r = client.post(
            "/v1/insights", content=raw, headers={"Content-Type": "application/json"}
        )
        assert r.status_code == 200
        json.loads(r.text)  # raises on NaN/Infinity with the default parser


class TestPayloadBounds:
    def test_oversized_row_count_is_rejected(self):
        r = client.post("/v1/insights", json={"rows": rows(30) * 100})
        assert r.status_code == 422

    def test_oversized_journal_text_is_rejected(self):
        r = client.post(
            "/v1/nlp",
            json={"texts": [{"nightOf": "2026-01-01", "day": "x" * 50_000}]},
        )
        assert r.status_code == 422

    def test_normal_journal_length_still_accepted(self):
        r = client.post(
            "/v1/nlp",
            json={"texts": [{"nightOf": "2026-01-01", "day": "Rough day, bad headache."}]},
        )
        assert r.status_code == 200


class TestSevenNightRefusal:
    """The project's hardest rule: under 7 complete nights, emit no prediction
    at all - not a hedged one."""

    @pytest.mark.parametrize("n", [0, 1, 3, 5, 6])
    def test_under_seven_nights_emits_nothing(self, n):
        body = client.post(
            "/v1/insights",
            json={"rows": [row(i, 20.0 + i, 400.0 + i * 8) for i in range(1, n + 1)]},
        ).json()
        fc = body["forecast"]
        assert fc["available"] is False
        assert fc["predictedBurden"] is None
        assert fc["confidence"] == "none"

    def test_seven_nights_is_no_longer_confidence_none(self):
        """The boundary actually moves at 7, so the refusal is about data volume
        and not a blanket refusal that would never lift."""
        body = client.post(
            "/v1/insights",
            json={"rows": [row(i, 20.0 + i, 400.0 + i * 8) for i in range(1, 8)]},
        ).json()
        assert body["forecast"]["confidence"] != "none"
