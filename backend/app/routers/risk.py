from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from typing import List, Optional

from app.database import get_db
from app.models.models import Risk, User
from app.schemas.schemas import (
    RiskCreate, RiskUpdate, RiskResponse,
    RiskActionAdd, RiskDashboard, MessageResponse
)
from app.core.security import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/risks", tags=["Risk Management"])


@router.get("/dashboard", response_model=RiskDashboard)
async def get_risk_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Get risk summary for dashboard. Manager/Admin only."""
    query = db.query(Risk).options(joinedload(Risk.user))

    if current_user.role == "manager" and current_user.cohort_number:
        cohort_ids = [
            u.id for u in db.query(User).filter(
                User.cohort_number == current_user.cohort_number
            ).all()
        ]
        query = query.filter(Risk.user_id.in_(cohort_ids))

    all_risks = query.all()

    def status_val(r):
        return r.status.value if hasattr(r.status, 'value') else str(r.status)

    def priority_val(r):
        return r.priority.value if hasattr(r.priority, 'value') else str(r.priority)

    def issue_val(r):
        return r.issue_type.value if hasattr(r.issue_type, 'value') else str(r.issue_type)

    red_risks = [r for r in all_risks if status_val(r) == "red"]
    yellow_risks = [r for r in all_risks if status_val(r) == "yellow"]
    green_risks = [r for r in all_risks if status_val(r) == "green"]
    high_priority = [r for r in all_risks if priority_val(r) == "high"]

    by_issue = {}
    for r in all_risks:
        it = issue_val(r)
        by_issue[it] = by_issue.get(it, 0) + 1

    recent_red = sorted(red_risks, key=lambda r: r.updated_at or r.created_at, reverse=True)[:5]

    return RiskDashboard(
        total_risks=len(all_risks),
        red_count=len(red_risks),
        yellow_count=len(yellow_risks),
        green_count=len(green_risks),
        high_priority=len(high_priority),
        by_issue_type=by_issue,
        recent_red_risks=[RiskResponse.model_validate(r) for r in recent_red]
    )


@router.get("/user/{user_id}", response_model=List[RiskResponse])
async def get_user_risks(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all risks for a specific user."""
    if current_user.role == "participant" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    risks = db.query(Risk).options(
        joinedload(Risk.user)
    ).filter(Risk.user_id == user_id).order_by(Risk.updated_at.desc()).all()

    return risks


@router.get("/", response_model=List[RiskResponse])
async def list_risks(
    skip: int = 0,
    limit: int = 100,
    risk_status: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    issue_type: Optional[str] = None,
    cohort_number: Optional[int] = None,
    country: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """List all risks. Manager/Admin only."""
    query = db.query(Risk).options(joinedload(Risk.user))

    if current_user.role == "manager" and current_user.cohort_number:
        cohort_ids = [
            u.id for u in db.query(User).filter(
                User.cohort_number == current_user.cohort_number
            ).all()
        ]
        query = query.filter(Risk.user_id.in_(cohort_ids))
    elif cohort_number or country:
        user_q = db.query(User)
        if cohort_number:
            user_q = user_q.filter(User.cohort_number == cohort_number)
        if country:
            user_q = user_q.filter(User.country == country)
        target_ids = [u.id for u in user_q.all()]
        query = query.filter(Risk.user_id.in_(target_ids))

    if risk_status:
        query = query.filter(Risk.status == risk_status)
    if priority:
        query = query.filter(Risk.priority == priority)
    if issue_type:
        query = query.filter(Risk.issue_type == issue_type)

    return query.order_by(Risk.updated_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=RiskResponse, status_code=status.HTTP_201_CREATED)
async def create_risk(
    data: RiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Create a new risk entry. Manager/Admin only."""
    target = db.query(User).filter(User.id == data.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    risk = Risk(
        user_id=data.user_id,
        issue_type=data.issue_type,
        priority=data.priority,
        status=data.status,
        description=data.description,
        action_history=data.action_history or [],
        last_updated_by=current_user.id
    )
    db.add(risk)
    db.commit()
    db.refresh(risk)

    return risk


@router.put("/{risk_id}", response_model=RiskResponse)
async def update_risk(
    risk_id: int,
    data: RiskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Update a risk entry's status or action."""
    risk = db.query(Risk).filter(Risk.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(risk, key, value)

    risk.last_updated_by = current_user.id
    risk.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(risk)

    return risk


@router.post("/{risk_id}/actions", response_model=RiskResponse)
async def add_risk_action(
    risk_id: int,
    data: RiskActionAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Add an action to a risk's history. Manager/Admin only."""
    risk = db.query(Risk).filter(Risk.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")

    new_action = {
        "action": data.action,
        "taken_by": current_user.username,
        "taken_by_id": current_user.id,
        "timestamp": datetime.utcnow().isoformat(),
        "notes": data.notes
    }

    current_history = risk.action_history or []
    current_history.append(new_action)
    risk.action_history = current_history
    risk.last_updated_by = current_user.id
    risk.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(risk)

    return risk


@router.delete("/{risk_id}", response_model=MessageResponse)
async def delete_risk(
    risk_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Delete a risk entry."""
    risk = db.query(Risk).filter(Risk.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")

    db.delete(risk)
    db.commit()
    return MessageResponse(message="Risk entry deleted successfully")
