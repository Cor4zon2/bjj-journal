from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession
from app.models import CommonMistake, Position, Technique, VideoLink
from app.models.enums import MASTERY_MAX, MASTERY_MIN, Stat, TechniqueType
from app.schemas.technique import (
    CommonMistakeCreate,
    CommonMistakeRead,
    CommonMistakeUpdate,
    TechniqueCreate,
    TechniqueDetail,
    TechniqueSummary,
    TechniqueUpdate,
    VideoLinkCreate,
    VideoLinkRead,
    VideoLinkUpdate,
)
from app.services.prereqs import PrereqError, check_prereqs
from app.services.slugs import slugify
from app.services.videos import detect_source, youtube_start_seconds

router = APIRouter(tags=["techniques"])

_DETAIL_OPTIONS = (
    selectinload(Technique.from_position),
    selectinload(Technique.to_position),
    selectinload(Technique.prereqs),
    selectinload(Technique.unlocks),
    selectinload(Technique.videos),
    selectinload(Technique.common_mistakes),
)


def _not_found(what: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")


def get_technique_or_404(db: DbSession, technique_id: int) -> Technique:
    technique = db.get(Technique, technique_id, options=_DETAIL_OPTIONS)
    if technique is None:
        raise _not_found("Technique")
    return technique


def _check_positions(db: DbSession, *position_ids: int | None) -> None:
    for position_id in position_ids:
        if position_id is not None and db.get(Position, position_id) is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, f"Position {position_id} does not exist"
            )


def _load_prereqs(
    db: DbSession, technique_id: int | None, prereq_ids: list[int]
) -> list[Technique]:
    unique_ids = list(dict.fromkeys(prereq_ids))
    prereqs = list(db.scalars(select(Technique).where(Technique.id.in_(unique_ids))))
    missing = set(unique_ids) - {t.id for t in prereqs}
    if missing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Prerequisite techniques do not exist: {sorted(missing)}",
        )
    try:
        check_prereqs(db, technique_id, unique_ids)
    except PrereqError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    return prereqs


def _commit_or_conflict(db: DbSession, slug: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"Slug '{slug}' is already taken") from exc


# ---- Techniques ----------------------------------------------------------------


@router.get("/techniques", response_model=list[TechniqueSummary])
def list_techniques(
    db: DbSession,
    position_id: Annotated[
        int | None, Query(description="Techniques that start or end in this position")
    ] = None,
    type: Annotated[TechniqueType | None, Query()] = None,
    stat: Annotated[Stat | None, Query()] = None,
    mastery: Annotated[int | None, Query(ge=MASTERY_MIN, le=MASTERY_MAX)] = None,
    min_mastery: Annotated[int | None, Query(ge=MASTERY_MIN, le=MASTERY_MAX)] = None,
    q: Annotated[str | None, Query(description="Search in name and summary")] = None,
) -> list[Technique]:
    query = select(Technique).options(
        selectinload(Technique.from_position), selectinload(Technique.to_position)
    )
    if position_id is not None:
        query = query.where(
            or_(Technique.from_position_id == position_id, Technique.to_position_id == position_id)
        )
    if type is not None:
        query = query.where(Technique.type == type)
    if stat is not None:
        query = query.where(Technique.stat == stat)
    if mastery is not None:
        query = query.where(Technique.mastery == mastery)
    if min_mastery is not None:
        query = query.where(Technique.mastery >= min_mastery)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.where(or_(Technique.name.ilike(pattern), Technique.summary.ilike(pattern)))
    return list(db.scalars(query.order_by(Technique.name)))


@router.post("/techniques", response_model=TechniqueDetail, status_code=status.HTTP_201_CREATED)
def create_technique(body: TechniqueCreate, db: DbSession) -> Technique:
    _check_positions(db, body.from_position_id, body.to_position_id)
    prereqs = _load_prereqs(db, None, body.prereq_ids)
    data = body.model_dump(exclude={"slug", "prereq_ids"})
    technique = Technique(**data, slug=body.slug or slugify(body.name), prereqs=prereqs)
    db.add(technique)
    _commit_or_conflict(db, technique.slug)
    return get_technique_or_404(db, technique.id)


@router.get("/techniques/{technique_id}", response_model=TechniqueDetail)
def get_technique(technique_id: int, db: DbSession) -> Technique:
    return get_technique_or_404(db, technique_id)


@router.get("/techniques/by-slug/{slug}", response_model=TechniqueDetail)
def get_technique_by_slug(slug: str, db: DbSession) -> Technique:
    technique = db.scalar(select(Technique).where(Technique.slug == slug).options(*_DETAIL_OPTIONS))
    if technique is None:
        raise _not_found("Technique")
    return technique


@router.patch("/techniques/{technique_id}", response_model=TechniqueDetail)
def update_technique(technique_id: int, body: TechniqueUpdate, db: DbSession) -> Technique:
    technique = get_technique_or_404(db, technique_id)
    changes = body.model_dump(exclude_unset=True)

    # `null` is meaningful only for the two optional positions.
    nullable = {"from_position_id", "to_position_id"}
    changes = {k: v for k, v in changes.items() if v is not None or k in nullable}

    _check_positions(db, changes.get("from_position_id"), changes.get("to_position_id"))
    if "prereq_ids" in changes:
        technique.prereqs = _load_prereqs(db, technique.id, changes.pop("prereq_ids"))
    for field, value in changes.items():
        setattr(technique, field, value)
    db.commit()
    db.expire_all()
    return get_technique_or_404(db, technique_id)


@router.delete("/techniques/{technique_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_technique(technique_id: int, db: DbSession) -> Response:
    db.delete(get_technique_or_404(db, technique_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- Video links ---------------------------------------------------------------


@router.post(
    "/techniques/{technique_id}/videos",
    response_model=VideoLinkRead,
    status_code=status.HTTP_201_CREATED,
)
def add_video(technique_id: int, body: VideoLinkCreate, db: DbSession) -> VideoLink:
    technique = get_technique_or_404(db, technique_id)
    source = body.source or detect_source(body.url)
    start = body.start_seconds
    if start is None:
        start = youtube_start_seconds(body.url) if source == "youtube" else 0
    video = VideoLink(url=body.url, title=body.title, source=source, start_seconds=start)
    technique.videos.append(video)
    db.commit()
    return video


def _get_video_or_404(db: DbSession, video_id: int) -> VideoLink:
    video = db.get(VideoLink, video_id)
    if video is None:
        raise _not_found("Video")
    return video


@router.patch("/videos/{video_id}", response_model=VideoLinkRead)
def update_video(video_id: int, body: VideoLinkUpdate, db: DbSession) -> VideoLink:
    video = _get_video_or_404(db, video_id)
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(video, field, value)
    db.commit()
    return video


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(video_id: int, db: DbSession) -> Response:
    db.delete(_get_video_or_404(db, video_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- Common mistakes -----------------------------------------------------------


@router.post(
    "/techniques/{technique_id}/common-mistakes",
    response_model=CommonMistakeRead,
    status_code=status.HTTP_201_CREATED,
)
def add_common_mistake(
    technique_id: int, body: CommonMistakeCreate, db: DbSession
) -> CommonMistake:
    technique = get_technique_or_404(db, technique_id)
    mistake = CommonMistake(**body.model_dump())
    technique.common_mistakes.append(mistake)
    db.commit()
    return mistake


def _get_mistake_or_404(db: DbSession, mistake_id: int) -> CommonMistake:
    mistake = db.get(CommonMistake, mistake_id)
    if mistake is None:
        raise _not_found("Common mistake")
    return mistake


@router.patch("/common-mistakes/{mistake_id}", response_model=CommonMistakeRead)
def update_common_mistake(
    mistake_id: int, body: CommonMistakeUpdate, db: DbSession
) -> CommonMistake:
    mistake = _get_mistake_or_404(db, mistake_id)
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(mistake, field, value)
    db.commit()
    return mistake


@router.delete("/common-mistakes/{mistake_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_common_mistake(mistake_id: int, db: DbSession) -> Response:
    db.delete(_get_mistake_or_404(db, mistake_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
