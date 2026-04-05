from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from typing import List, Optional

from app.database import get_db
from app.models.models import Announcement, AnnouncementRead, User
from app.schemas.schemas import (
    AnnouncementCreate, AnnouncementUpdate, AnnouncementResponse,
    AnnouncementReadResponse, MessageResponse
)
from app.core.security import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/announcements", tags=["Announcements"])


def user_can_see_announcement(user: User, announcement: Announcement) -> bool:
    """Check if a user should see this announcement based on target."""
    tt = announcement.target_type
    tv = announcement.target_value

    if hasattr(tt, 'value'):
        tt = tt.value

    if tt == "all":
        return True
    elif tt == "cohort":
        return str(user.cohort_number) == str(tv)
    elif tt == "team":
        return user.team == tv
    elif tt == "country":
        return user.country == tv
    return False


@router.get("/", response_model=List[AnnouncementResponse])
async def list_announcements(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List announcements filtered by the current user's target group."""
    query = db.query(Announcement).options(joinedload(Announcement.author))

    all_announcements = query.order_by(Announcement.created_at.desc()).all()

    if current_user.role == "admin":
        visible = all_announcements
    else:
        visible = [a for a in all_announcements if user_can_see_announcement(current_user, a)]

    # Add read counts
    result = []
    for ann in visible[skip:skip + limit]:
        ann_dict = AnnouncementResponse.model_validate(ann)
        ann_dict.read_count = db.query(AnnouncementRead).filter(
            AnnouncementRead.announcement_id == ann.id
        ).count()
        result.append(ann_dict)

    return result


@router.post("/", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Create a new announcement. Manager or Admin only."""
    ann = Announcement(
        title=data.title,
        content=data.content,
        target_type=data.target_type,
        target_value=data.target_value,
        author_id=current_user.id,
        is_scheduled=data.is_scheduled,
        scheduled_at=data.scheduled_at,
        sent_at=None if data.is_scheduled else datetime.utcnow()
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)

    return ann


@router.get("/{announcement_id}", response_model=AnnouncementResponse)
async def get_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific announcement."""
    ann = db.query(Announcement).options(
        joinedload(Announcement.author)
    ).filter(Announcement.id == announcement_id).first()

    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    if current_user.role != "admin" and not user_can_see_announcement(current_user, ann):
        raise HTTPException(status_code=403, detail="Access forbidden")

    result = AnnouncementResponse.model_validate(ann)
    result.read_count = db.query(AnnouncementRead).filter(
        AnnouncementRead.announcement_id == announcement_id
    ).count()
    return result


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: int,
    data: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Update an announcement."""
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    # Only admin or the original author can update
    if current_user.role != "admin" and ann.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author or admin can edit this announcement")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(ann, key, value)

    db.commit()
    db.refresh(ann)
    return ann


@router.delete("/{announcement_id}", response_model=MessageResponse)
async def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Delete an announcement."""
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    if current_user.role != "admin" and ann.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author or admin can delete this announcement")

    # Delete reads first
    db.query(AnnouncementRead).filter(AnnouncementRead.announcement_id == announcement_id).delete()
    db.delete(ann)
    db.commit()

    return MessageResponse(message="Announcement deleted successfully")


@router.post("/{announcement_id}/read", response_model=MessageResponse)
async def mark_as_read(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark an announcement as read by the current user."""
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    existing = db.query(AnnouncementRead).filter(
        AnnouncementRead.announcement_id == announcement_id,
        AnnouncementRead.user_id == current_user.id
    ).first()

    if existing:
        return MessageResponse(message="Already marked as read")

    read_record = AnnouncementRead(
        announcement_id=announcement_id,
        user_id=current_user.id
    )
    db.add(read_record)
    db.commit()

    return MessageResponse(message="Marked as read")


@router.get("/{announcement_id}/read-status", response_model=List[AnnouncementReadResponse])
async def get_read_status(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Get who has read an announcement. Manager/Admin only."""
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    reads = db.query(AnnouncementRead).options(
        joinedload(AnnouncementRead.user)
    ).filter(AnnouncementRead.announcement_id == announcement_id).all()

    return reads


@router.post("/{announcement_id}/resend", response_model=AnnouncementResponse)
async def resend_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
):
    """Resend (mark as newly sent) an announcement."""
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    if current_user.role != "admin" and ann.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author or admin can resend this announcement")

    # Update sent_at to now
    ann.sent_at = datetime.utcnow()
    ann.is_scheduled = False
    db.commit()
    db.refresh(ann)

    return ann
