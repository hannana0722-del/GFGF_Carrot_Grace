from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime
from typing import List, Optional
from collections import Counter

from app.database import get_db
from app.models.models import DailyReport, User
from app.schemas.schemas import (
    DailyReportCreate, DailyReportUpdate, DailyReportResponse,
    DailyReportStats, UserSummary, MessageResponse
)
from app.core.security import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/daily-reports", tags=["Daily Reports"])


@router.get("/missing", response_model=List[UserSummary])
async def get_missing_reporters(
    report_date: Optional[date] = None,
    cohort_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Get list of users who haven't submitted their daily report. Manager/Admin only."""
    target_date = report_date or date.today()

    user_query = db.query(User).filter(User.role == "participant", User.is_active == True)
    if cohort_number:
        user_query = user_query.filter(User.cohort_number == cohort_number)
    elif current_user.role == "manager" and current_user.cohort_number:
        user_query = user_query.filter(User.cohort_number == current_user.cohort_number)

    all_participants = user_query.all()

    submitted_ids = {
        r.user_id for r in db.query(DailyReport).filter(
            DailyReport.report_date == target_date
        ).all()
    }

    missing = [u for u in all_participants if u.id not in submitted_ids]
    return missing


@router.get("/stats", response_model=DailyReportStats)
async def get_report_stats(
    report_date: Optional[date] = None,
    cohort_number: Optional[int] = None,
    country: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Get daily report statistics."""
    query = db.query(DailyReport)

    if report_date:
        query = query.filter(DailyReport.report_date == report_date)

    if cohort_number or country:
        user_q = db.query(User)
        if cohort_number:
            user_q = user_q.filter(User.cohort_number == cohort_number)
        if country:
            user_q = user_q.filter(User.country == country)
        target_ids = [u.id for u in user_q.all()]
        query = query.filter(DailyReport.user_id.in_(target_ids))

    reports = query.all()
    total = len(reports)

    scores = [r.satisfaction_score for r in reports if r.satisfaction_score is not None]
    avg_score = round(sum(scores) / len(scores), 2) if scores else None

    emotions = [r.emotion_tag for r in reports if r.emotion_tag]
    emotion_dist = dict(Counter(emotions))

    # Calculate submission rate for today if no date given
    target_date = report_date or date.today()
    total_participants = db.query(User).filter(
        User.role == "participant",
        User.is_active == True
    ).count()
    reports_today = db.query(DailyReport).filter(
        DailyReport.report_date == target_date
    ).count()
    submission_rate = round(reports_today / total_participants * 100, 1) if total_participants > 0 else 0.0

    return DailyReportStats(
        total_reports=total,
        avg_satisfaction=avg_score,
        emotion_distribution=emotion_dist,
        submission_rate=submission_rate
    )


@router.get("/", response_model=List[DailyReportResponse])
async def list_reports(
    skip: int = 0,
    limit: int = 100,
    report_date: Optional[date] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List daily reports."""
    query = db.query(DailyReport).options(joinedload(DailyReport.user))

    if current_user.role == "participant":
        query = query.filter(DailyReport.user_id == current_user.id)
    elif current_user.role == "manager":
        if current_user.cohort_number:
            cohort_ids = [
                u.id for u in db.query(User).filter(
                    User.cohort_number == current_user.cohort_number
                ).all()
            ]
            query = query.filter(DailyReport.user_id.in_(cohort_ids))
        if user_id:
            query = query.filter(DailyReport.user_id == user_id)
    else:
        if user_id:
            query = query.filter(DailyReport.user_id == user_id)

    if report_date:
        query = query.filter(DailyReport.report_date == report_date)

    return query.order_by(DailyReport.report_date.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=DailyReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_report(
    data: DailyReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a daily report."""
    # Check for duplicate
    existing = db.query(DailyReport).filter(
        DailyReport.user_id == current_user.id,
        DailyReport.report_date == data.report_date,
        DailyReport.role_type == data.role_type
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report already submitted for {data.report_date}"
        )

    # Manager reports need manager_id
    manager_id = None
    if data.role_type.value == "manager" or str(data.role_type) == "manager":
        if current_user.role not in ("manager", "admin"):
            raise HTTPException(status_code=403, detail="Only managers can submit manager reports")
        manager_id = current_user.id

    report = DailyReport(
        user_id=current_user.id,
        report_date=data.report_date,
        activities=data.activities,
        emotion_tag=data.emotion_tag,
        satisfaction_score=data.satisfaction_score,
        photo_urls=data.photo_urls,
        role_type=data.role_type,
        manager_id=manager_id or data.manager_id
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return report


@router.get("/{report_id}", response_model=DailyReportResponse)
async def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific daily report."""
    report = db.query(DailyReport).options(
        joinedload(DailyReport.user)
    ).filter(DailyReport.id == report_id).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role == "participant" and report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    return report


@router.put("/{report_id}", response_model=DailyReportResponse)
async def update_report(
    report_id: int,
    data: DailyReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a daily report."""
    report = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role == "participant" and report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(report, key, value)

    db.commit()
    db.refresh(report)
    return report


@router.delete("/{report_id}", response_model=MessageResponse)
async def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a daily report."""
    report = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role == "participant" and report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    if current_user.role not in ("admin", "manager") and report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    db.delete(report)
    db.commit()
    return MessageResponse(message="Report deleted successfully")
