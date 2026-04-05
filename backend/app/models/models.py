from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Time,
    ForeignKey, Text, Float, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    participant = "participant"


class TargetType(str, enum.Enum):
    all = "all"
    cohort = "cohort"
    team = "team"
    country = "country"


class SurveyType(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"


class SignalColor(str, enum.Enum):
    green = "green"
    yellow = "yellow"
    red = "red"


class SubmissionStatus(str, enum.Enum):
    submitted = "submitted"
    late = "late"
    missing = "missing"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    late = "late"
    absent = "absent"
    early_leave = "early_leave"


class AttendanceMethod(str, enum.Enum):
    qr = "qr"
    manual = "manual"


class IssueType(str, enum.Enum):
    health = "health"
    attendance = "attendance"
    assignment = "assignment"
    behavior = "behavior"


class RiskPriority(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class RiskStatus(str, enum.Enum):
    red = "red"
    yellow = "yellow"
    green = "green"


class ReportRoleType(str, enum.Enum):
    participant = "participant"
    manager = "manager"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.participant)
    cohort_number = Column(Integer, nullable=True)
    team = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    full_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    announcements = relationship("Announcement", back_populates="author", foreign_keys="Announcement.author_id")
    health_checks = relationship("HealthCheck", back_populates="user")
    assignment_submissions = relationship("AssignmentSubmission", back_populates="user")
    attendance_records = relationship("Attendance", back_populates="user", foreign_keys="Attendance.user_id")
    daily_reports = relationship("DailyReport", back_populates="user", foreign_keys="DailyReport.user_id")
    risks = relationship("Risk", back_populates="user", foreign_keys="Risk.user_id")
    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    announcement_reads = relationship("AnnouncementRead", back_populates="user")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    target_type = Column(SAEnum(TargetType), nullable=False, default=TargetType.all)
    target_value = Column(String(100), nullable=True)  # cohort number, team name, or country
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_scheduled = Column(Boolean, default=False)
    scheduled_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author = relationship("User", back_populates="announcements", foreign_keys=[author_id])
    reads = relationship("AnnouncementRead", back_populates="announcement")


class AnnouncementRead(Base):
    __tablename__ = "announcement_reads"

    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    announcement = relationship("Announcement", back_populates="reads")
    user = relationship("User", back_populates="announcement_reads")


class HealthCheck(Base):
    __tablename__ = "health_checks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    check_date = Column(Date, nullable=False)
    survey_type = Column(SAEnum(SurveyType), nullable=False, default=SurveyType.daily)
    responses = Column(JSON, nullable=True)  # Survey answers stored as JSON
    signal_color = Column(SAEnum(SignalColor), nullable=False, default=SignalColor.green)
    emergency_requested = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="health_checks")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    cohort_number = Column(Integer, nullable=True)
    due_date = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    submissions = relationship("AssignmentSubmission", back_populates="assignment")


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_url = Column(String(500), nullable=True)
    link_url = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)
    status = Column(SAEnum(SubmissionStatus), nullable=False, default=SubmissionStatus.missing)
    feedback = Column(Text, nullable=True)
    score = Column(Float, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    assignment = relationship("Assignment", back_populates="submissions")
    user = relationship("User", back_populates="assignment_submissions")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_date = Column(Date, nullable=False)
    session_type = Column(String(100), nullable=True)  # e.g., "morning", "afternoon", "workshop"
    check_in_time = Column(DateTime, nullable=True)
    check_out_time = Column(DateTime, nullable=True)
    status = Column(SAEnum(AttendanceStatus), nullable=False, default=AttendanceStatus.present)
    reason = Column(Text, nullable=True)  # Reason for absence/late
    method = Column(SAEnum(AttendanceMethod), nullable=False, default=AttendanceMethod.manual)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="attendance_records", foreign_keys=[user_id])
    recorder = relationship("User", foreign_keys=[recorded_by])


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_date = Column(Date, nullable=False)
    activities = Column(Text, nullable=True)
    emotion_tag = Column(String(50), nullable=True)  # e.g., "happy", "tired", "anxious"
    satisfaction_score = Column(Integer, nullable=True)  # 1-5
    photo_urls = Column(JSON, nullable=True)  # List of photo URLs
    submitted_at = Column(DateTime, default=datetime.utcnow)
    role_type = Column(SAEnum(ReportRoleType), nullable=False, default=ReportRoleType.participant)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # For manager reports
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="daily_reports", foreign_keys=[user_id])
    manager = relationship("User", foreign_keys=[manager_id])


class Risk(Base):
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issue_type = Column(SAEnum(IssueType), nullable=False)
    priority = Column(SAEnum(RiskPriority), nullable=False, default=RiskPriority.medium)
    status = Column(SAEnum(RiskStatus), nullable=False, default=RiskStatus.yellow)
    description = Column(Text, nullable=True)
    action_history = Column(JSON, nullable=True, default=list)  # List of actions taken
    last_updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="risks", foreign_keys=[user_id])
    updater = relationship("User", foreign_keys=[last_updated_by])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="audit_logs")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)  # e.g., "announcement", "assignment", "risk_alert"
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False)
    related_resource_type = Column(String(100), nullable=True)
    related_resource_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notifications")
