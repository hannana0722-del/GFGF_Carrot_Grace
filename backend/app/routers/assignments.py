from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from typing import List, Optional

from app.database import get_db
from app.models.models import Assignment, AssignmentSubmission, User
from app.schemas.schemas import (
    AssignmentCreate, AssignmentUpdate, AssignmentResponse,
    SubmissionCreate, SubmissionUpdate, SubmissionResponse,
    AssignmentStats, MessageResponse
)
from app.core.security import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/assignments", tags=["Assignments"])


@router.get("/stats", response_model=AssignmentStats)
async def get_assignment_stats(
    cohort_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Get assignment submission statistics. Manager/Admin only."""
    assignment_query = db.query(Assignment)
    if cohort_number:
        assignment_query = assignment_query.filter(Assignment.cohort_number == cohort_number)

    assignments = assignment_query.all()
    assignment_ids = [a.id for a in assignments]

    if not assignment_ids:
        return AssignmentStats(
            total_assignments=0, total_submissions=0,
            submitted=0, late=0, missing=0, submission_rate=0.0
        )

    submissions = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id.in_(assignment_ids)
    ).all()

    total_submissions = len(submissions)
    submitted = sum(1 for s in submissions if str(s.status.value if hasattr(s.status, 'value') else s.status) == "submitted")
    late = sum(1 for s in submissions if str(s.status.value if hasattr(s.status, 'value') else s.status) == "late")
    missing = sum(1 for s in submissions if str(s.status.value if hasattr(s.status, 'value') else s.status) == "missing")

    rate = round((submitted + late) / total_submissions * 100, 1) if total_submissions > 0 else 0.0

    return AssignmentStats(
        total_assignments=len(assignments),
        total_submissions=total_submissions,
        submitted=submitted,
        late=late,
        missing=missing,
        submission_rate=rate
    )


@router.get("/", response_model=List[AssignmentResponse])
async def list_assignments(
    skip: int = 0,
    limit: int = 50,
    cohort_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List assignments."""
    query = db.query(Assignment).options(joinedload(Assignment.creator))

    if current_user.role == "participant":
        # Participants see assignments for their cohort
        if current_user.cohort_number:
            query = query.filter(
                (Assignment.cohort_number == current_user.cohort_number) |
                (Assignment.cohort_number == None)
            )
    elif cohort_number:
        query = query.filter(Assignment.cohort_number == cohort_number)

    assignments = query.order_by(Assignment.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for assignment in assignments:
        a_dict = AssignmentResponse.model_validate(assignment)
        a_dict.submission_count = len(assignment.submissions)
        a_dict.submitted_count = sum(
            1 for s in assignment.submissions
            if str(s.status.value if hasattr(s.status, 'value') else s.status) in ("submitted", "late")
        )
        result.append(a_dict)

    return result


@router.post("/", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Create a new assignment. Manager/Admin only."""
    assignment = Assignment(
        title=data.title,
        description=data.description,
        cohort_number=data.cohort_number,
        due_date=data.due_date,
        created_by=current_user.id
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return assignment


@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get assignment detail with submissions."""
    assignment = db.query(Assignment).options(
        joinedload(Assignment.creator),
        joinedload(Assignment.submissions).joinedload(AssignmentSubmission.user)
    ).filter(Assignment.id == assignment_id).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    result = AssignmentResponse.model_validate(assignment)

    if current_user.role == "participant":
        # Participants only see their own submission
        result.submissions = [
            SubmissionResponse.model_validate(s)
            for s in assignment.submissions
            if s.user_id == current_user.id
        ]
    else:
        result.submissions = [SubmissionResponse.model_validate(s) for s in assignment.submissions]

    result.submission_count = len(assignment.submissions)
    result.submitted_count = sum(
        1 for s in assignment.submissions
        if str(s.status.value if hasattr(s.status, 'value') else s.status) in ("submitted", "late")
    )

    return result


@router.put("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: int,
    data: AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Update an assignment."""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(assignment, key, value)

    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}", response_model=MessageResponse)
async def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Delete an assignment."""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id
    ).delete()
    db.delete(assignment)
    db.commit()

    return MessageResponse(message="Assignment deleted successfully")


@router.post("/{assignment_id}/submit", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def submit_assignment(
    assignment_id: int,
    data: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit an assignment."""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Check for existing submission
    existing = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id,
        AssignmentSubmission.user_id == current_user.id
    ).first()

    now = datetime.utcnow()

    # Determine if submission is late
    is_late = False
    if assignment.due_date and now > assignment.due_date:
        is_late = True

    if existing:
        # Update existing submission
        existing.file_url = data.file_url or existing.file_url
        existing.link_url = data.link_url or existing.link_url
        existing.content = data.content or existing.content
        existing.status = "late" if is_late else "submitted"
        existing.submitted_at = now
        db.commit()
        db.refresh(existing)
        return existing

    submission = AssignmentSubmission(
        assignment_id=assignment_id,
        user_id=current_user.id,
        file_url=data.file_url,
        link_url=data.link_url,
        content=data.content,
        status="late" if is_late else "submitted",
        submitted_at=now
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    return submission


@router.put("/{assignment_id}/submissions/{submission_id}", response_model=SubmissionResponse)
async def update_submission(
    assignment_id: int,
    submission_id: int,
    data: SubmissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Update submission feedback/score. Manager/Admin only."""
    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.id == submission_id,
        AssignmentSubmission.assignment_id == assignment_id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(submission, key, value)

    db.commit()
    db.refresh(submission)
    return submission
