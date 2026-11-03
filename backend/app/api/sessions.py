"""Class log and my mistakes."""

from collections import Counter
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession
from app.models import ClassSession, MyMistake, Position, SessionTechnique, Technique
from app.models.enums import MistakeStatus
from app.schemas.journal import (
    ClassSessionCreate,
    ClassSessionRead,
    ClassSessionUpdate,
    MistakeCreate,
    MistakeUpdate,
    MistakeWithSession,
    SessionMistakeWrite,
    SessionTechniqueWrite,
)

router = APIRouter(tags=["class log"])

_SESSION_OPTIONS = (
    selectinload(ClassSession.techniques).selectinload(SessionTechnique.technique),
    selectinload(ClassSession.mistakes).selectinload(MyMistake.technique),
    selectinload(ClassSession.mistakes).selectinload(MyMistake.position),
)
_MISTAKE_OPTIONS = (
    selectinload(MyMistake.technique),
    selectinload(MyMistake.position),
    selectinload(MyMistake.session),
)


def _unprocessable(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message)


def _check_exist(db: DbSession, model: type[Technique | Position], ids: Iterable[int]) -> None:
    wanted = set(ids)
    if not wanted:
        return
    found = set(db.scalars(select(model.id).where(model.id.in_(wanted))))
    missing = sorted(wanted - found)
    if missing:
        raise _unprocessable(f"{model.__name__} does not exist: {missing}")


def _check_mistake_links(
    db: DbSession, mistakes: Iterable[SessionMistakeWrite | MistakeCreate]
) -> None:
    items = list(mistakes)
    _check_exist(db, Technique, (m.technique_id for m in items if m.technique_id is not None))
    _check_exist(db, Position, (m.position_id for m in items if m.position_id is not None))


def _set_status(mistake: MyMistake, new_status: MistakeStatus) -> None:
    if new_status == "fixed" and mistake.status != "fixed":
        mistake.fixed_at = datetime.now(UTC)
    elif new_status != "fixed":
        mistake.fixed_at = None
    mistake.status = new_status


def _hits(rows: Iterable[SessionTechnique | SessionTechniqueWrite]) -> Counter[int]:
    return Counter(row.technique_id for row in rows if row.kind == "hit_in_rolling")


def _apply_hit_changes(db: DbSession, before: Counter[int], after: Counter[int]) -> None:
    """Keep each technique's `times_hit` in step with the classes where it was hit."""
    for technique_id in before.keys() | after.keys():
        delta = after[technique_id] - before[technique_id]
        if delta == 0:
            continue
        technique = db.get(Technique, technique_id)
        if technique is not None:
            technique.times_hit = max(0, technique.times_hit + delta)


def _technique_rows(rows: list[SessionTechniqueWrite]) -> list[SessionTechnique]:
    unique = dict.fromkeys((row.technique_id, row.kind) for row in rows)
    return [SessionTechnique(technique_id=tid, kind=kind) for tid, kind in unique]


def _new_mistake(data: SessionMistakeWrite | MistakeCreate) -> MyMistake:
    mistake = MyMistake(
        technique_id=data.technique_id,
        position_id=data.position_id,
        category=data.category,
        description=data.description,
        status="open",
    )
    _set_status(mistake, data.status)
    return mistake


def get_session_or_404(db: DbSession, session_id: int) -> ClassSession:
    session = db.get(ClassSession, session_id, options=_SESSION_OPTIONS)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    return session


def _reload_session(db: DbSession, session_id: int) -> ClassSession:
    db.expire_all()
    return get_session_or_404(db, session_id)


# ---- Class sessions ------------------------------------------------------------


@router.get("/sessions", response_model=list[ClassSessionRead])
def list_sessions(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ClassSession]:
    """Logged classes, newest first."""
    query = (
        select(ClassSession)
        .options(*_SESSION_OPTIONS)
        .order_by(ClassSession.date.desc(), ClassSession.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(query))


@router.post("/sessions", response_model=ClassSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(body: ClassSessionCreate, response: Response, db: DbSession) -> ClassSession:
    """Log a class with its techniques and mistakes in one request."""
    if body.client_id:
        existing = db.scalar(
            select(ClassSession.id).where(ClassSession.client_id == body.client_id)
        )
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            return get_session_or_404(db, existing)

    _check_exist(db, Technique, (row.technique_id for row in body.techniques))
    _check_mistake_links(db, body.mistakes)

    techniques = _technique_rows(body.techniques)
    session = ClassSession(
        client_id=body.client_id or None,
        date=body.date,
        type=body.type,
        duration_min=body.duration_min,
        energy=body.energy,
        rolling_notes=body.rolling_notes,
        techniques=techniques,
        mistakes=[_new_mistake(m) for m in body.mistakes],
    )
    db.add(session)
    _apply_hit_changes(db, Counter(), _hits(techniques))
    db.commit()
    return _reload_session(db, session.id)


@router.get("/sessions/{session_id}", response_model=ClassSessionRead)
def get_session(session_id: int, db: DbSession) -> ClassSession:
    return get_session_or_404(db, session_id)


@router.patch("/sessions/{session_id}", response_model=ClassSessionRead)
def update_session(session_id: int, body: ClassSessionUpdate, db: DbSession) -> ClassSession:
    session = get_session_or_404(db, session_id)
    changes = body.model_dump(exclude_unset=True, exclude={"techniques", "mistakes"})
    # `null` is meaningful for the optional fields only.
    nullable = {"duration_min", "energy"}
    for field, value in changes.items():
        if value is not None or field in nullable:
            setattr(session, field, value)

    if body.techniques is not None:
        _check_exist(db, Technique, (row.technique_id for row in body.techniques))
        before = _hits(session.techniques)
        session.techniques.clear()
        db.flush()
        session.techniques.extend(_technique_rows(body.techniques))
        _apply_hit_changes(db, before, _hits(session.techniques))

    if body.mistakes is not None:
        _sync_mistakes(db, session, body.mistakes)

    db.commit()
    return _reload_session(db, session_id)


def _sync_mistakes(
    db: DbSession, session: ClassSession, mistakes: list[SessionMistakeWrite]
) -> None:
    _check_mistake_links(db, mistakes)
    current = {m.id: m for m in session.mistakes}
    unknown = sorted(m.id for m in mistakes if m.id is not None and m.id not in current)
    if unknown:
        raise _unprocessable(f"Mistakes do not belong to this class: {unknown}")

    kept: list[MyMistake] = []
    for data in mistakes:
        if data.id is None:
            kept.append(_new_mistake(data))
            continue
        mistake = current[data.id]
        mistake.technique_id = data.technique_id
        mistake.position_id = data.position_id
        mistake.category = data.category
        mistake.description = data.description
        _set_status(mistake, data.status)
        kept.append(mistake)
    session.mistakes = kept


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, db: DbSession) -> Response:
    """Delete a class, with the mistakes logged in it."""
    session = get_session_or_404(db, session_id)
    _apply_hit_changes(db, _hits(session.techniques), Counter())
    db.delete(session)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- My mistakes ---------------------------------------------------------------


def _get_mistake_or_404(db: DbSession, mistake_id: int) -> MyMistake:
    mistake = db.get(MyMistake, mistake_id, options=_MISTAKE_OPTIONS)
    if mistake is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mistake not found")
    return mistake


@router.get("/mistakes", response_model=list[MistakeWithSession])
def list_mistakes(
    db: DbSession,
    status_: Annotated[MistakeStatus | None, Query(alias="status")] = None,
    technique_id: Annotated[int | None, Query()] = None,
    position_id: Annotated[int | None, Query()] = None,
) -> list[MyMistake]:
    """My mistakes, newest first."""
    query = select(MyMistake).options(*_MISTAKE_OPTIONS)
    if status_ is not None:
        query = query.where(MyMistake.status == status_)
    if technique_id is not None:
        query = query.where(MyMistake.technique_id == technique_id)
    if position_id is not None:
        query = query.where(MyMistake.position_id == position_id)
    return list(db.scalars(query.order_by(MyMistake.created_at.desc(), MyMistake.id.desc())))


@router.post("/mistakes", response_model=MistakeWithSession, status_code=status.HTTP_201_CREATED)
def create_mistake(body: MistakeCreate, db: DbSession) -> MyMistake:
    _check_mistake_links(db, [body])
    if body.session_id is not None:
        get_session_or_404(db, body.session_id)
    mistake = _new_mistake(body)
    mistake.session_id = body.session_id
    db.add(mistake)
    db.commit()
    db.expire_all()
    return _get_mistake_or_404(db, mistake.id)


@router.patch("/mistakes/{mistake_id}", response_model=MistakeWithSession)
def update_mistake(mistake_id: int, body: MistakeUpdate, db: DbSession) -> MyMistake:
    """Edit a mistake or move it along: Open → Working on it → Fixed."""
    mistake = _get_mistake_or_404(db, mistake_id)
    changes = body.model_dump(exclude_unset=True)
    nullable = {"technique_id", "position_id"}
    changes = {k: v for k, v in changes.items() if v is not None or k in nullable}
    if changes.get("technique_id") is not None:
        _check_exist(db, Technique, [changes["technique_id"]])
    if changes.get("position_id") is not None:
        _check_exist(db, Position, [changes["position_id"]])
    if "description" in changes:
        changes["description"] = changes["description"].strip()
        if not changes["description"]:
            raise _unprocessable("Describe the mistake")
    if "status" in changes:
        _set_status(mistake, changes.pop("status"))
    for field, value in changes.items():
        setattr(mistake, field, value)
    db.commit()
    db.expire_all()
    return _get_mistake_or_404(db, mistake_id)


@router.delete("/mistakes/{mistake_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mistake(mistake_id: int, db: DbSession) -> Response:
    db.delete(_get_mistake_or_404(db, mistake_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
