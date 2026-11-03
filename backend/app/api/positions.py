from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DbSession
from app.models import Position
from app.schemas.position import PositionCreate, PositionRead, PositionUpdate
from app.services.slugs import slugify

router = APIRouter(prefix="/positions", tags=["positions"])


def get_position_or_404(db: DbSession, position_id: int) -> Position:
    position = db.get(Position, position_id)
    if position is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Position not found")
    return position


@router.get("", response_model=list[PositionRead])
def list_positions(db: DbSession) -> list[Position]:
    return list(db.scalars(select(Position).order_by(Position.category, Position.name)))


@router.post("", response_model=PositionRead, status_code=status.HTTP_201_CREATED)
def create_position(body: PositionCreate, db: DbSession) -> Position:
    position = Position(
        name=body.name,
        slug=body.slug or slugify(body.name),
        category=body.category,
        description=body.description,
    )
    db.add(position)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Slug '{position.slug}' is already taken"
        ) from exc
    return position


@router.get("/{position_id}", response_model=PositionRead)
def get_position(position_id: int, db: DbSession) -> Position:
    return get_position_or_404(db, position_id)


@router.patch("/{position_id}", response_model=PositionRead)
def update_position(position_id: int, body: PositionUpdate, db: DbSession) -> Position:
    position = get_position_or_404(db, position_id)
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(position, field, value)
    db.commit()
    return position


@router.delete("/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_position(position_id: int, db: DbSession) -> Response:
    """Delete a position. Techniques that started or ended there keep existing."""
    db.delete(get_position_or_404(db, position_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
