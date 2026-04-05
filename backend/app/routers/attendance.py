from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime
from typing import List, Optional

from app.database import get_db
from app.models.models import Attendance, User
from app.schemas.schemas import (
    AttendanceCreate, AttendanceUpdate, AttendanceResponse,
    AttendanceStats, QRCheckinRequest, MessageResponse
)
from app.core.security import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/today", response_model=List[AttendanceResponse])
async def get_today_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get today's attendance status."""
    today = date.today()
    query = db.query(Attendance).options(joinedload(Attendance.user)).filter(
        Attendance.session_date == today
    )

    if current_user.role == "participant":
        query = query.filter(Attendance.user_id == current_user.id)
    elif current_user.role == "manager" and current_user.cohort_number:
        cohort_ids = [
            u.id for u in db.query(User).filter(
                User.cohort_number == current_user.cohort_number
            ).all()
        ]
        query = query.filter(Attendance.user_id.in_(cohort_ids))

    return query.all()


@router.get("/stats", response_model=AttendanceStats)
async def get_attendance_stats(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    cohort_number: Optional[int] = None,
    country: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Get attendance statistics. Manager/Admin only."""
    query = db.query(Attendance)

    if start_date:
        query = query.filter(Attendance.session_date >= start_date)
    if end_date:
        query = query.filter(Attendance.session_date <= end_date)

    if cohort_number or country:
        user_query = db.query(User)
        if cohort_number:
            user_query = user_query.filter(User.cohort_number == cohort_number)
        if country:
            user_query = user_query.filter(User.country == country)
        target_ids = [u.id for u in user_query.all()]
        query = query.filter(Attendance.user_id.in_(target_ids))

    records = query.all()
    total = len(records)

    if total == 0:
        return AttendanceStats(
            total_sessions=0, present=0, late=0, absent=0,
            early_leave=0, attendance_rate=0.0
        )

    def status_val(r):
        return r.status.value if hasattr(r.status, 'value') else str(r.status)

    present = sum(1 for r in records if status_val(r) == "present")
    late = sum(1 for r in records if status_val(r) == "late")
    absent = sum(1 for r in records if status_val(r) == "absent")
    early_leave = sum(1 for r in records if status_val(r) == "early_leave")

    attendance_rate = round((present + late) / total * 100, 1)

    # Group by country
    users = {u.id: u for u in db.query(User).all()}
    by_country = {}
    for r in records:
        user = users.get(r.user_id)
        if user and user.country:
            c = user.country
            if c not in by_country:
                by_country[c] = {"present": 0, "late": 0, "absent": 0, "early_leave": 0, "total": 0}
            by_country[c][status_val(r)] = by_country[c].get(status_val(r), 0) + 1
            by_country[c]["total"] += 1

    by_team = {}
    for r in records:
        user = users.get(r.user_id)
        if user and user.team:
            t = user.team
            if t not in by_team:
                by_team[t] = {"present": 0, "late": 0, "absent": 0, "early_leave": 0, "total": 0}
            by_team[t][status_val(r)] = by_team[t].get(status_val(r), 0) + 1
            by_team[t]["total"] += 1

    return AttendanceStats(
        total_sessions=total,
        present=present,
        late=late,
        absent=absent,
        early_leave=early_leave,
        attendance_rate=attendance_rate,
        by_country=by_country,
        by_team=by_team
    )


@router.get("/", response_model=List[AttendanceResponse])
async def list_attendance(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List attendance records."""
    query = db.query(Attendance).options(joinedload(Attendance.user))

    if current_user.role == "participant":
        query = query.filter(Attendance.user_id == current_user.id)
    elif current_user.role == "manager" and current_user.cohort_number:
        cohort_ids = [
            u.id for u in db.query(User).filter(
                User.cohort_number == current_user.cohort_number
            ).all()
        ]
        query = query.filter(Attendance.user_id.in_(cohort_ids))
        if user_id:
            query = query.filter(Attendance.user_id == user_id)
    else:
        if user_id:
            query = query.filter(Attendance.user_id == user_id)

    if start_date:
        query = query.filter(Attendance.session_date >= start_date)
    if end_date:
        query = query.filter(Attendance.session_date <= end_date)
    if status_filter:
        query = query.filter(Attendance.status == status_filter)

    return query.order_by(Attendance.session_date.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def record_attendance(
    data: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Record attendance manually. Manager/Admin only."""
    target_user = db.query(User).filter(User.id == data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for duplicate
    existing = db.query(Attendance).filter(
        Attendance.user_id == data.user_id,
        Attendance.session_date == data.session_date,
        Attendance.session_type == data.session_type
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance record already exists for this user, date, and session"
        )

    record = Attendance(
        user_id=data.user_id,
        session_date=data.session_date,
        session_type=data.session_type,
        check_in_time=data.check_in_time,
        check_out_time=data.check_out_time,
        status=data.status,
        reason=data.reason,
        method=data.method,
        recorded_by=current_user.id
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return record


@router.put("/{attendance_id}", response_model=AttendanceResponse)
async def update_attendance(
    attendance_id: int,
    data: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Update an attendance record. Manager/Admin only."""
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(record, key, value)

    record.recorded_by = current_user.id
    db.commit()
    db.refresh(record)

    return record


@router.post("/qr-checkin", response_model=AttendanceResponse)
async def qr_checkin(
    data: QRCheckinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """QR code check-in endpoint. Creates or updates today's attendance."""
    # Simple QR validation - in production, verify against a stored QR token
    if not data.qr_code or len(data.qr_code) < 4:
        raise HTTPException(status_code=400, detail="Invalid QR code")

    today = date.today()
    now = datetime.utcnow()

    existing = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.session_date == today,
        Attendance.session_type == (data.session_type or "morning")
    ).first()

    if existing:
        # If already checked in, update check-out time
        if existing.check_in_time and not existing.check_out_time:
            existing.check_out_time = now
            db.commit()
            db.refresh(existing)
            return existing
        return existing

    # Create attendance record
    # Determine if late (after 9:30 AM)
    is_late = now.hour >= 9 and now.minute > 30

    record = Attendance(
        user_id=current_user.id,
        session_date=today,
        session_type=data.session_type or "morning",
        check_in_time=now,
        status="late" if is_late else "present",
        method="qr",
        recorded_by=current_user.id
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return record
