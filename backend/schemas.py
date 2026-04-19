from pydantic import BaseModel, Field
from typing import List, Optional

class KPIItem(BaseModel):
    id: str
    name: str
    value: float
    trend: str
    direction: str
    source: str
    method: str
    unit: Optional[str] = None

class RadarItem(BaseModel):
    name: str
    value: float
    max: float

class DashboardOverviewResponse(BaseModel):
    kpis: List[KPIItem]
    radar_data: List[RadarItem]
    last_updated: str

class MapFeature(BaseModel):
    name: str
    value: float

class ScatterAlert(BaseModel):
    name: str
    value: List[float]
    detail: str

class RiskMapResponse(BaseModel):
    metric: str
    region_level: str
    map_data: List[MapFeature]
    scatter_alerts: List[ScatterAlert]
    legend: dict

class PolicyRequest(BaseModel):
    guarantee_rate: float = Field(10.0, ge=5, le=30)
    interest_offset: float = Field(-0.5, ge=-2.0, le=0)
    subsidy_level: int = Field(1, ge=1, le=3)

class PolicyTool(BaseModel):
    name: str
    intensity: str
    rationale: str

class PolicyPathStep(BaseModel):
    stage: str
    impact: str

class IndustryNodeRecommendation(BaseModel):
    guarantee_rate_delta: float
    interest_offset_delta: float
    subsidy_level_delta: int

class IndustryNode(BaseModel):
    id: str
    name: str
    symbolSize: float
    category: int
    risk_level: str
    risk_score: float
    description: str
    policy_focus: str
    recommended_adjustments: IndustryNodeRecommendation

class IndustryLink(BaseModel):
    source: str
    target: str
    value: float
    risk_type: str
    explanation: str

class IndustryCategory(BaseModel):
    name: str

class IndustryGraphResponse(BaseModel):
    industry: str
    industry_summary: str
    policy_hint: str
    focus_node_id: str
    nodes: List[IndustryNode]
    links: List[IndustryLink]
    categories: List[IndustryCategory]

class PolicyScorecard(BaseModel):
    efficiency_score: float
    coverage_score: float
    implementation_score: float
    composite_score: float

class PolicyResponse(BaseModel):
    current_npl: float
    predicted_npl: float
    did_estimate: float
    fiscal_cost_billion: float
    benefit_enterprise_count: int
    roi: float
    roi_unit: str
    effect_direction: str
    policy_bucket: str
    scenario_summary: str
    risk_warnings: List[Optional[str]]
    prediction_months: List[str]
    prediction_values: List[float]
    policy_tools: List[PolicyTool]
    transmission_paths: List[PolicyPathStep]
    target_segments: List[str]
    implementation_conditions: List[str]
    evidence_points: List[str]
    scorecard: PolicyScorecard
    policy_recommendation: str

class ProvinceDetailResponse(BaseModel):
    province: str
    npl: float
    credit_index: float
    micro_health: float
    alert: Optional[str]
    industry_distribution: List[dict]
    risk_factors: List[dict]
