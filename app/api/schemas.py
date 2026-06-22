"""
Response schemas for the GridLock Command API.

Only the shapes that need explicit Pydantic typing are here.
Most endpoints return plain dicts built in readers.py / main.py.
"""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


class OkResponse(BaseModel):
    ok: bool
    message: str
    data: Optional[Any] = None


class HealthResponse(BaseModel):
    ok: bool
    service: str
    mode: str
    timestamp: str
    key_files: dict[str, bool]


class HotspotRow(BaseModel):
    cluster_id: str
    centroid_lat: Optional[float]
    centroid_lng: Optional[float]
    assigned_station: Optional[str]
    border_flag: Optional[int]
    road_class: Optional[str]
    road_width_m: Optional[float]
    osm_coverage: Optional[int]
    violation_count: Optional[int]
    vehicle_mix: Optional[str]
    lcle_pct: Optional[float]
    bci: Optional[float]
    persistence: Optional[float]
    recurrence: Optional[float]
    peak_window: Optional[str]
    roi_score: Optional[float]
    classification: Optional[str]
    recommended_action: Optional[str]


class NotificationItem(BaseModel):
    id: str
    filename: str
    recipient: str
    subject: str
    body: str
    kind: str  # head_officer / officer / tow / unknown


class InfraCandidate(BaseModel):
    cluster_id: str
    infra_assessment_count: Optional[int]
    infra_independent_officer_count: Optional[int]
    infra_max_severity: Optional[int]
    infra_avg_severity: Optional[float]
    infra_dominant_cause: Optional[str]
    infra_suggested_fix: Optional[str]
    infra_escalation_ready: Optional[int]
    infra_structural_boost: Optional[int]


class PdfItem(BaseModel):
    filename: str
    size: int
    modified_at: str
    url: str


class OfficerFeedbackRequest(BaseModel):
    cluster_id: str
    officer_id: Optional[str] = None
    action: str          # towed / warned / could_not_enforce
    outcome: str         # resolved / recurred / no_violation
    reason_code: Optional[str] = None   # no_parking_space / loading / broke_down / ignored_sign / customer_waiting / other
    assigned_station: Optional[str] = None
    reason_text: Optional[str] = None
    source: Optional[str] = "frontend_demo"


class CitizenFeedbackRequest(BaseModel):
    cluster_id: str
    reason_code: str     # no_parking_space / loading / broke_down / ignored_sign / customer_waiting / other
    reason_text: Optional[str] = None
    source: Optional[str] = "frontend_demo"
