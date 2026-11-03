"""Profile (belt, stripes, focus) and the progress summary shown on Home."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import DbSession
from app.models import PROFILE_ID, ClassSession, MyMistake, Profile, Technique
from app.schemas.position import PositionRef
from app.schemas.progress import (
    ProfileRead,
    ProfileUpdate,
    ProgressRead,
    StatRead,
    StreakRead,
    TopMistakeRead,
)
from app.schemas.technique import TechniqueRef, TechniqueSummary
from app.services import progress

router = APIRouter(tags=["progress"])


def get_profile(db: Session) -> Profile:
    """The single profile row. Created with the starting defaults if it is missing."""
    profile = db.get(Profile, PROFILE_ID)
    if profile is None:
        profile = Profile(id=PROFILE_ID, belt="white", stripes=1, focus_technique_ids=[])
        db.add(profile)
        db.commit()
    return profile


@router.get("/profile", response_model=ProfileRead)
def read_profile(db: DbSession) -> Profile:
    return get_profile(db)


@router.patch("/profile", response_model=ProfileRead)
def update_profile(body: ProfileUpdate, db: DbSession) -> Profile:
    """Set belt and stripes, or the current focus techniques."""
    profile = get_profile(db)
    if body.belt is not None:
        profile.belt = body.belt
    if body.stripes is not None:
        profile.stripes = body.stripes
    if body.focus_technique_ids is not None:
        ids = body.focus_technique_ids
        found = set(db.scalars(select(Technique.id).where(Technique.id.in_(ids))))
        missing = [i for i in ids if i not in found]
        if missing:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, f"Technique does not exist: {missing}"
            )
        profile.focus_technique_ids = ids
    db.commit()
    return profile


@router.get("/progress", response_model=ProgressRead)
def read_progress(
    db: DbSession,
    today: Annotated[
        date | None,
        Query(description="The phone's local date. Defaults to the server's date."),
    ] = None,
) -> ProgressRead:
    """Belt, classes and mat time, stats, weekly streak, focus techniques and top mistake."""
    today = today or date.today()
    profile = get_profile(db)

    sessions = db.execute(select(ClassSession.date, ClassSession.duration_min)).all()
    dates = [row.date for row in sessions if row.date <= today]
    durations = [row.duration_min for row in sessions if row.date <= today]

    masteries = (
        (row.stat, row.mastery) for row in db.execute(select(Technique.stat, Technique.mastery))
    )
    stats = progress.stat_scores(masteries)

    return ProgressRead(
        today=today,
        belt=profile.belt,
        stripes=profile.stripes,
        classes=len(dates),
        classes_this_month=sum(progress.same_month(d, today) for d in dates),
        mat_hours=round(progress.mat_minutes(durations) / 60, 1),
        streak=StreakRead.model_validate(progress.weekly_streak(dates, today)),
        stats=[StatRead.model_validate(s) for s in stats],
        focus=_focus(db, profile.focus_technique_ids),
        top_mistake=_top_mistake(db, today),
    )


def _focus(db: Session, ids: list[int]) -> list[TechniqueSummary]:
    if not ids:
        return []
    techniques = {
        t.id: t
        for t in db.scalars(
            select(Technique)
            .where(Technique.id.in_(ids))
            .options(selectinload(Technique.from_position), selectinload(Technique.to_position))
        )
    }
    # Keep the chosen order; skip techniques deleted since.
    return [TechniqueSummary.model_validate(techniques[i]) for i in ids if i in techniques]


def _top_mistake(db: Session, today: date) -> TopMistakeRead | None:
    rows = db.execute(
        select(MyMistake, ClassSession.date)
        .outerjoin(ClassSession, MyMistake.session_id == ClassSession.id)
        .where(MyMistake.status != "fixed")
    ).all()
    samples = [
        progress.MistakeSample(
            id=mistake.id,
            # A mistake belongs to the day of its class; one logged on its own, to the day it
            # was written down.
            day=session_date or mistake.created_at.date(),
            technique_id=mistake.technique_id,
            position_id=mistake.position_id,
            category=mistake.category,
            status=mistake.status,
        )
        for mistake, session_date in rows
    ]
    top = progress.top_mistake(samples, today)
    if top is None:
        return None
    latest = db.get(
        MyMistake,
        top.latest_id,
        options=(selectinload(MyMistake.technique), selectinload(MyMistake.position)),
    )
    assert latest is not None
    return TopMistakeRead(
        count=top.count,
        category=top.category,
        description=latest.description,
        mistake_id=latest.id,
        technique=TechniqueRef.model_validate(latest.technique) if latest.technique else None,
        # Grouped by technique when there is one, so the position is shown only without it.
        position=PositionRef.model_validate(latest.position)
        if latest.position is not None and latest.technique is None
        else None,
    )
