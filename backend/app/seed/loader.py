"""Load the starting technique library from YAML into the database."""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import CommonMistake, Position, Technique, VideoLink, technique_prereq
from app.models.enums import MASTERY_MAX, MASTERY_MIN, PositionCategory, Stat, TechniqueType
from app.services.videos import detect_source

DEFAULT_SEED_FILE = Path(__file__).with_name("techniques.yaml")


class SeedError(ValueError):
    pass


# ---- File format ---------------------------------------------------------------


class _Strict(BaseModel):
    model_config = {"extra": "forbid"}


class SeedPosition(_Strict):
    slug: str
    name: str
    category: PositionCategory
    description: str = ""


class SeedMistake(_Strict):
    title: str
    why_it_happens: str = ""
    fix: str = ""


class SeedVideo(_Strict):
    url: str
    title: str = ""
    start_seconds: int = 0


class SeedTechnique(_Strict):
    slug: str
    name: str
    type: TechniqueType
    stat: Stat
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    summary: str = ""
    mastery: int = Field(default=0, ge=MASTERY_MIN, le=MASTERY_MAX)
    gi_only: bool = False
    prereqs: list[str] = []
    steps: list[str] = []
    key_details: list[str] = []
    common_mistakes: list[SeedMistake] = []
    videos: list[SeedVideo] = []


class SeedFile(_Strict):
    positions: list[SeedPosition] = []
    techniques: list[SeedTechnique] = []


def read_seed_file(path: Path = DEFAULT_SEED_FILE) -> SeedFile:
    raw: Any = yaml.safe_load(path.read_text(encoding="utf-8"))
    try:
        seed = SeedFile.model_validate(raw)
    except ValidationError as exc:
        raise SeedError(f"{path}: {exc}") from exc
    _check_references(seed)
    return seed


def _check_references(seed: SeedFile) -> None:
    position_slugs = {p.slug for p in seed.positions}
    technique_slugs = {t.slug for t in seed.techniques}
    if len(position_slugs) != len(seed.positions):
        raise SeedError("Duplicate position slugs")
    if len(technique_slugs) != len(seed.techniques):
        raise SeedError("Duplicate technique slugs")
    for technique in seed.techniques:
        for ref in (technique.from_, technique.to):
            if ref is not None and ref not in position_slugs:
                raise SeedError(f"{technique.slug}: unknown position '{ref}'")
        for prereq in technique.prereqs:
            if prereq not in technique_slugs:
                raise SeedError(f"{technique.slug}: unknown prerequisite '{prereq}'")


# ---- Loading -------------------------------------------------------------------


@dataclass
class SeedResult:
    positions_added: int = 0
    techniques_added: int = 0
    techniques_skipped: int = 0


def reset_library(db: Session) -> None:
    """Delete every technique and position (and their videos, mistakes, prereqs)."""
    db.execute(delete(technique_prereq))
    db.execute(delete(VideoLink))
    db.execute(delete(CommonMistake))
    db.execute(delete(Technique))
    db.execute(delete(Position))


def load_seed(db: Session, seed: SeedFile, *, reset: bool = False) -> SeedResult:
    """Insert positions and techniques that are not in the database yet (matched by slug).

    Existing rows are left alone so personal notes, steps and mastery levels survive.
    With `reset=True` the library is wiped first.
    """
    if reset:
        reset_library(db)
    result = SeedResult()

    positions = {p.slug: p for p in db.scalars(select(Position))}
    for seed_position in seed.positions:
        if seed_position.slug not in positions:
            position = Position(**seed_position.model_dump())
            db.add(position)
            positions[seed_position.slug] = position
            result.positions_added += 1
    db.flush()

    techniques = {t.slug: t for t in db.scalars(select(Technique))}
    new_items: list[SeedTechnique] = []
    for item in seed.techniques:
        if item.slug in techniques:
            result.techniques_skipped += 1
            continue
        technique = Technique(
            slug=item.slug,
            name=item.name,
            type=item.type,
            stat=item.stat,
            from_position=positions[item.from_] if item.from_ else None,
            to_position=positions[item.to] if item.to else None,
            summary=item.summary,
            mastery=item.mastery,
            gi_only=item.gi_only,
            steps=item.steps,
            key_details=item.key_details,
            common_mistakes=[CommonMistake(**m.model_dump()) for m in item.common_mistakes],
            videos=[VideoLink(**v.model_dump(), source=detect_source(v.url)) for v in item.videos],
        )
        db.add(technique)
        techniques[item.slug] = technique
        new_items.append(item)
        result.techniques_added += 1
    db.flush()

    # Prerequisites are set only on newly added techniques, after all of them exist.
    for item in new_items:
        techniques[item.slug].prereqs = [techniques[slug] for slug in item.prereqs]

    db.commit()
    return result
