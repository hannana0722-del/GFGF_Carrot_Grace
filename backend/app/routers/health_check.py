from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime
from typing import List, Optional

from app.database import get_db
from app.models.models import HealthCheck, User
from app.schemas.schemas import (
    HealthCheckCreate, HealthCheckUpdate, HealthCheckResponse,
    HealthCheckStats, MessageResponse
)
from app.core.security import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/health-checks", tags=["Health Checks"])


@router.get("/", response_model=List[HealthCheckResponse])
async def list_health_checks(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    signal_color: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List health checks. Admins/managers see all; participants see only their own."""
    query = db.query(HealthCheck).options(joinedload(HealthCheck.user))

    if current_user.role == "participant":
        query = query.filter(HealthCheck.user_id == current_user.id)
    elif current_user.role == "manager":
        if user_id:
            query = query.filter(HealthCheck.user_id == user_id)
        elif current_user.cohort_number:
            cohort_user_ids = [
                u.id for u in db.query(User).filter(
                    User.cohort_number == current_user.cohort_number
                ).all()
            ]
            query = query.filter(HealthCheck.user_id.in_(cohort_user_ids))
    else:
        # Admin - can filter by specific user
        if user_id:
            query = query.filter(HealthCheck.user_id == user_id)

    if start_date:
        query = query.filter(HealthCheck.check_date >= start_date)
    if end_date:
        query = query.filter(HealthCheck.check_date <= end_date)
    if signal_color:
        query = query.filter(HealthCheck.signal_color == signal_color)

    return query.order_by(HealthCheck.check_date.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=HealthCheckResponse, status_code=status.HTTP_201_CREATED)
async def submit_health_check(
    data: HealthCheckCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a health check for today."""
    # Check if already submitted for this date and type
    existing = db.query(HealthCheck).filter(
        HealthCheck.user_id == current_user.id,
        HealthCheck.check_date == data.check_date,
        HealthCheck.survey_type == data.survey_type
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Health check already submitted for {data.check_date} ({data.survey_type})"
        )

    check = HealthCheck(
        user_id=current_user.id,
        check_date=data.check_date,
        survey_type=data.survey_type,
        responses=data.responses,
        signal_color=data.signal_color,
        emergency_requested=data.emergency_requested,
        notes=data.notes
    )
    db.add(check)
    db.commit()
    db.refresh(check)

    return check


@router.get("/stats", response_model=HealthCheckStats)
async def get_health_check_stats(
    check_date: Optional[date] = None,
    cohort_number: Optional[int] = None,
    country: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Get health check statistics. Manager/Admin only."""
    query = db.query(HealthCheck)

    if check_date:
        query = query.filter(HealthCheck.check_date == check_date)

    if cohort_number or country:
        user_query = db.query(User)
        if cohort_number:
            user_query = user_query.filter(User.cohort_number == cohort_number)
        if country:
            user_query = user_query.filter(User.country == country)
        target_ids = [u.id for u in user_query.all()]
        query = query.filter(HealthCheck.user_id.in_(target_ids))

    checks = query.all()
    total = len(checks)

    if total == 0:
        return HealthCheckStats(
            total=0, green=0, yellow=0, red=0, emergency_count=0,
            green_pct=0.0, yellow_pct=0.0, red_pct=0.0
        )

    green = sum(1 for c in checks if str(c.signal_color.value if hasattr(c.signal_color, 'value') else c.signal_color) == "green")
    yellow = sum(1 for c in checks if str(c.signal_color.value if hasattr(c.signal_color, 'value') else c.signal_color) == "yellow")
    red = sum(1 for c in checks if str(c.signal_color.value if hasattr(c.signal_color, 'value') else c.signal_color) == "red")
    emergency = sum(1 for c in checks if c.emergency_requested)

    return HealthCheckStats(
        total=total,
        green=green,
        yellow=yellow,
        red=red,
        emergency_count=emergency,
        green_pct=round(green / total * 100, 1),
        yellow_pct=round(yellow / total * 100, 1),
        red_pct=round(red / total * 100, 1)
    )


@router.get("/{user_id}/history", response_model=List[HealthCheckResponse])
async def get_user_health_history(
    user_id: int,
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get health check history for a specific user."""
    # Participants can only see their own history
    if current_user.role == "participant" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    checks = db.query(HealthCheck).filter(
        HealthCheck.user_id == user_id
    ).order_by(HealthCheck.check_date.desc()).offset(skip).limit(limit).all()

    return checks


@router.put("/{check_id}", response_model=HealthCheckResponse)
async def update_health_check(
    check_id: int,
    data: HealthCheckUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a health check. Managers/admins can update signal manually."""
    check = db.query(HealthCheck).filter(HealthCheck.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Health check not found")

    # Participants can only update their own checks and cannot change signal manually
    if current_user.role == "participant":
        if check.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access forbidden")
        # Participants cannot manually change signal_color
        if data.signal_color is not None:
            raise HTTPException(status_code=403, detail="Participants cannot manually change signal color")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(check, key, value)

    db.commit()
    db.refresh(check)
    return check
