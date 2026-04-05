from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from app.database import get_db
from app.models.models import User, AuditLog
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate, Token, MessageResponse
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin
)
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


def log_audit(db: Session, user_id: int, action: str, resource_type: str = None,
              resource_id: int = None, details: dict = None, ip: str = None):
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip
    )
    db.add(log)
    db.commit()


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and receive JWT access token."""
    user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact administrator."
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value if hasattr(user.role, 'value') else user.role},
        expires_delta=access_token_expires
    )

    # Audit log
    client_ip = request.client.host if request.client else None
    log_audit(db, user.id, "login", "user", user.id, {"username": user.username}, client_ip)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Register a new user. Admin only."""
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role=user_data.role,
        cohort_number=user_data.cohort_number,
        team=user_data.team,
        country=user_data.country,
        full_name=user_data.full_name,
        phone=user_data.phone,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Audit log
    log_audit(
        db, current_user.id, "create_user", "user", new_user.id,
        {"created_username": user_data.username, "role": user_data.role}
    )

    return new_user


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user's info."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update current user's own profile (non-role fields)."""
    # Non-admin users cannot change their own role
    if current_user.role != "admin" and update_data.role is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change your own role"
        )

    update_dict = update_data.model_dump(exclude_unset=True)

    if "password" in update_dict:
        update_dict["hashed_password"] = get_password_hash(update_dict.pop("password"))

    for key, value in update_dict.items():
        setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role: str = None,
    country: str = None,
    cohort_number: int = None,
    skip: int = 0,
    limit: int = 100
):
    """List users. Admin sees all; managers see their cohort; participants see teammates."""
    query = db.query(User)

    if current_user.role == "participant":
        # Participants can only see members of their own team
        query = query.filter(User.team == current_user.team)
    elif current_user.role == "manager":
        # Managers see their cohort
        if current_user.cohort_number:
            query = query.filter(User.cohort_number == current_user.cohort_number)

    if role:
        query = query.filter(User.role == role)
    if country:
        query = query.filter(User.country == country)
    if cohort_number is not None:
        query = query.filter(User.cohort_number == cohort_number)

    return query.offset(skip).limit(limit).all()


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific user's info."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Participants can only view their own profile
    if current_user.role == "participant" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update user info. Admin only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_dict = update_data.model_dump(exclude_unset=True)
    if "password" in update_dict:
        update_dict["hashed_password"] = get_password_hash(update_dict.pop("password"))

    for key, value in update_dict.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    log_audit(db, current_user.id, "update_user", "user", user_id, {"fields": list(update_dict.keys())})
    return user
