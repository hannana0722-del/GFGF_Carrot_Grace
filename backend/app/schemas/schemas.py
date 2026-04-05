from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Any, Dict
from datetime import datetime, date
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    admin = "admin"
    manager = "manager"
    participant = "participant"


class TargetType(str, Enum):
    all = "all"
    cohort = "cohort"
    team = "team"
    country = "country"


class SurveyType(str, Enum):
    daily = "daily"
    weekly = "weekly"


class SignalColor(str, Enum):
    green = "green"
    yellow = "yellow"
    red = "red"


class SubmissionStatus(str, Enum):
    submitted = "submitted"
    late = "late"
    missing = "missing"


class AttendanceStatus(str, Enum):
    present = "present"
    late = "late"
    absent = "absent"
    early_leave = "early_leave"


class AttendanceMethod(str, Enum):
    qr = "qr"
    manual = "manual"


class IssueType(str, Enum):
    health = "health"
    attendance = "attendance"
    assignment = "assignment"
    behavior = "behavior"


class RiskPriority(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class RiskStatus(str, Enum):
    red = "red"
    yellow = "yellow"
    green = "green"


class ReportRoleType(str, Enum):
    participant = "participant"
    manager = "manager"


# ─── Token Schemas ────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserResponse"


class TokenData(BaseModel):
    username: Optional[str] = None


# ─── User Schemas ─────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    role: UserRole = UserRole.participant
    cohort_number: Optional[int] = None
    team: Optional[str] = None
    country: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    cohort_number: Optional[int] = None
    team: Optional[str] = None
    country: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    cohort_number: Optional[int]
    team: Optional[str]
    country: Optional[str]
    full_name: Optional[str]
    phone: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserSummary(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    role: str
    country: Optional[str]
    team: Optional[str]

    class Config:
        from_attributes = True


# ─── Announcement Schemas ─────────────────────────────────────────────────────

class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str
    target_type: TargetType = TargetType.all
    target_value: Optional[str] = None
    is_scheduled: bool = False
    scheduled_at: Optional[datetime] = None


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    target_type: Optional[TargetType] = None
    target_value: Optional[str] = None
    is_scheduled: Optional[bool] = None
    scheduled_at: Optional[datetime] = None


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    content: str
    target_type: str
    target_value: Optional[str]
    author_id: int
    is_scheduled: bool
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]
    created_at: datetime
    author: Optional[UserSummary] = None
    read_count: Optional[int] = None

    class Config:
        from_attributes = True


class AnnouncementReadResponse(BaseModel):
    id: int
    announcement_id: int
    user_id: int
    read_at: datetime
    user: Optional[UserSummary] = None

    class Config:
        from_attributes = True


# ─── Health Check Schemas ─────────────────────────────────────────────────────

class HealthCheckBase(BaseModel):
    check_date: date
    survey_type: SurveyType = SurveyType.daily
    responses: Optional[Dict[str, Any]] = None
    signal_color: SignalColor = SignalColor.green
    emergency_requested: bool = False
    notes: Optional[str] = None


class HealthCheckCreate(HealthCheckBase):
    pass


class HealthCheckUpdate(BaseModel):
    signal_color: Optional[SignalColor] = None
    emergency_requested: Optional[bool] = None
    notes: Optional[str] = None
    responses: Optional[Dict[str, Any]] = None


class HealthCheckResponse(BaseModel):
    id: int
    user_id: int
    check_date: date
    survey_type: str
    responses: Optional[Dict[str, Any]]
    signal_color: str
    emergency_requested: bool
    notes: Optional[str]
    created_at: datetime
    user: Optional[UserSummary] = None

    class Config:
        from_attributes = True


class HealthCheckStats(BaseModel):
    total: int
    green: int
    yellow: int
    red: int
    emergency_count: int
    green_pct: float
    yellow_pct: float
    red_pct: float


# ─── Assignment Schemas ───────────────────────────────────────────────────────

class AssignmentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    cohort_number: Optional[int] = None
    due_date: Optional[datetime] = None


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cohort_number: Optional[int] = None
    due_date: Optional[datetime] = None


class SubmissionBase(BaseModel):
    file_url: Optional[str] = None
    link_url: Optional[str] = None
    content: Optional[str] = None


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionUpdate(BaseModel):
    file_url: Optional[str] = None
    link_url: Optional[str] = None
    content: Optional[str] = None
    status: Optional[SubmissionStatus] = None
    feedback: Optional[str] = None
    score: Optional[float] = None


class SubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    user_id: int
    file_url: Optional[str]
    link_url: Optional[str]
    content: Optional[str]
    status: str
    feedback: Optional[str]
    score: Optional[float]
    submitted_at: Optional[datetime]
    updated_at: Optional[datetime]
    user: Optional[UserSummary] = None

    class Config:
        from_attributes = True


class AssignmentResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    cohort_number: Optional[int]
    due_date: Optional[datetime]
    created_by: int
    created_at: datetime
    creator: Optional[UserSummary] = None
    submissions: Optional[List[SubmissionResponse]] = None
    submission_count: Optional[int] = None
    submitted_count: Optional[int] = None

    class Config:
        from_attributes = True


class AssignmentStats(BaseModel):
    total_assignments: int
    total_submissions: int
    submitted: int
    late: int
    missing: int
    submission_rate: float


# ─── Attendance Schemas ───────────────────────────────────────────────────────

class AttendanceBase(BaseModel):
    user_id: int
    session_date: date
    session_type: Optional[str] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: AttendanceStatus = AttendanceStatus.present
    reason: Optional[str] = None
    method: AttendanceMethod = AttendanceMethod.manual


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceUpdate(BaseModel):
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: Optional[AttendanceStatus] = None
    reason: Optional[str] = None
    method: Optional[AttendanceMethod] = None


class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    session_date: date
    session_type: Optional[str]
    check_in_time: Optional[datetime]
    check_out_time: Optional[datetime]
    status: str
    reason: Optional[str]
    method: str
    recorded_by: Optional[int]
    created_at: datetime
    user: Optional[UserSummary] = None

    class Config:
        from_attributes = True


class QRCheckinRequest(BaseModel):
    qr_code: str
    session_type: Optional[str] = None


class AttendanceStats(BaseModel):
    total_sessions: int
    present: int
    late: int
    absent: int
    early_leave: int
    attendance_rate: float
    by_country: Optional[Dict[str, Any]] = None
    by_team: Optional[Dict[str, Any]] = None


# ─── Daily Report Schemas ─────────────────────────────────────────────────────

class DailyReportBase(BaseModel):
    report_date: date
    activities: Optional[str] = None
    emotion_tag: Optional[str] = None
    satisfaction_score: Optional[int] = Field(None, ge=1, le=5)
    photo_urls: Optional[List[str]] = None
    role_type: ReportRoleType = ReportRoleType.participant
    manager_id: Optional[int] = None


class DailyReportCreate(DailyReportBase):
    pass


class DailyReportUpdate(BaseModel):
    activities: Optional[str] = None
    emotion_tag: Optional[str] = None
    satisfaction_score: Optional[int] = Field(None, ge=1, le=5)
    photo_urls: Optional[List[str]] = None


class DailyReportResponse(BaseModel):
    id: int
    user_id: int
    report_date: date
    activities: Optional[str]
    emotion_tag: Optional[str]
    satisfaction_score: Optional[int]
    photo_urls: Optional[List[str]]
    submitted_at: Optional[datetime]
    role_type: str
    manager_id: Optional[int]
    user: Optional[UserSummary] = None

    class Config:
        from_attributes = True


class DailyReportStats(BaseModel):
    total_reports: int
    avg_satisfaction: Optional[float]
    emotion_distribution: Dict[str, int]
    submission_rate: float
    missing_users: Optional[List[UserSummary]] = None


# ─── Risk Schemas ─────────────────────────────────────────────────────────────

class RiskAction(BaseModel):
    action: str
    taken_by: str
    timestamp: str
    notes: Optional[str] = None


class RiskBase(BaseModel):
    user_id: int
    issue_type: IssueType
    priority: RiskPriority = RiskPriority.medium
    status: RiskStatus = RiskStatus.yellow
    description: Optional[str] = None
    action_history: Optional[List[Dict[str, Any]]] = None


class RiskCreate(RiskBase):
    pass


class RiskUpdate(BaseModel):
    issue_type: Optional[IssueType] = None
    priority: Optional[RiskPriority] = None
    status: Optional[RiskStatus] = None
    description: Optional[str] = None
    action_history: Optional[List[Dict[str, Any]]] = None


class RiskResponse(BaseModel):
    id: int
    user_id: int
    issue_type: str
    priority: str
    status: str
    description: Optional[str]
    action_history: Optional[List[Dict[str, Any]]]
    last_updated_by: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    user: Optional[UserSummary] = None

    class Config:
        from_attributes = True


class RiskActionAdd(BaseModel):
    action: str
    notes: Optional[str] = None


class RiskDashboard(BaseModel):
    total_risks: int
    red_count: int
    yellow_count: int
    green_count: int
    high_priority: int
    by_issue_type: Dict[str, int]
    recent_red_risks: List[RiskResponse]


# ─── Dashboard Schemas ────────────────────────────────────────────────────────

class KPIMetrics(BaseModel):
    date: str
    total_participants: int
    attendance_rate: float
    report_submission_rate: float
    health_green_rate: float
    active_risks: int
    emergency_alerts: int
    pending_assignments: int


class AttendanceChartData(BaseModel):
    labels: List[str]
    datasets: List[Dict[str, Any]]


class AlertItem(BaseModel):
    id: int
    type: str
    message: str
    priority: str
    user: Optional[UserSummary]
    created_at: datetime


class DashboardReport(BaseModel):
    generated_at: datetime
    kpi: KPIMetrics
    attendance_summary: Dict[str, Any]
    health_summary: HealthCheckStats
    risk_summary: RiskDashboard
    top_risks: List[RiskResponse]


# ─── Audit Log Schemas ────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[int]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Notification Schemas ─────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: Optional[str]
    is_read: bool
    related_resource_type: Optional[str]
    related_resource_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Generic Response ─────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    per_page: int
    total_pages: int


# Update forward references
Token.model_rebuild()
