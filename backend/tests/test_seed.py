from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CommonMistake, Position, Technique
from app.seed.loader import SeedError, load_seed, read_seed_file


def _count(db: Session, model: type[Position] | type[Technique] | type[CommonMistake]) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def test_seed_file_covers_the_roadmap() -> None:
    seed = read_seed_file()
    slugs = {t.slug for t in seed.techniques}

    assert len(seed.techniques) == 17
    assert {"sit-down-guard-pull", "pull-to-de-la-riva", "berimbolo", "tripod-sweep"} <= slugs
    for technique in seed.techniques:
        assert technique.steps, technique.slug
        assert technique.key_details, technique.slug
        assert 2 <= len(technique.common_mistakes) <= 4, technique.slug


def test_seed_levels_follow_the_unlock_rule() -> None:
    """Anything above Locked must have all prerequisites at Drilled or better."""
    seed = read_seed_file()
    mastery = {t.slug: t.mastery for t in seed.techniques}

    for technique in seed.techniques:
        if technique.mastery > 0:
            assert all(mastery[p] >= 2 for p in technique.prereqs), technique.slug
    assert mastery["dlr-back-take"] == 0
    assert mastery["berimbolo"] == 0


def test_load_seed_inserts_everything(db: Session) -> None:
    result = load_seed(db, read_seed_file())

    assert result.techniques_added == 17
    assert result.positions_added == _count(db, Position) == 10
    assert _count(db, Technique) == 17
    assert _count(db, CommonMistake) > 17

    pull = db.scalar(select(Technique).where(Technique.slug == "pull-to-de-la-riva"))
    assert pull is not None
    assert pull.from_position is not None and pull.from_position.slug == "standing"
    assert {p.slug for p in pull.prereqs} == {
        "collar-sleeve-guard-pull",
        "dlr-hook-entry-and-retention",
    }


def test_reloading_keeps_my_edits(db: Session) -> None:
    load_seed(db, read_seed_file())
    technique = db.scalar(select(Technique).where(Technique.slug == "tripod-sweep"))
    assert technique is not None
    technique.notes = "Works great on taller partners"
    technique.mastery = 3
    db.commit()

    result = load_seed(db, read_seed_file())

    assert result.techniques_added == 0
    assert result.techniques_skipped == 17
    db.refresh(technique)
    assert technique.notes == "Works great on taller partners"
    assert technique.mastery == 3


def test_reset_restores_the_seed(db: Session) -> None:
    load_seed(db, read_seed_file())
    db.add(Position(slug="turtle", name="Turtle", category="bottom", description=""))
    db.commit()

    result = load_seed(db, read_seed_file(), reset=True)

    assert result.techniques_added == 17
    assert _count(db, Position) == 10


def test_unknown_prereq_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "seed.yaml"
    path.write_text(
        "techniques:\n  - {slug: a, name: A, type: sweep, stat: sweeps, prereqs: [missing]}\n",
        encoding="utf-8",
    )

    with pytest.raises(SeedError, match="unknown prerequisite 'missing'"):
        read_seed_file(path)


def test_invalid_type_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "seed.yaml"
    path.write_text(
        "techniques:\n  - {slug: a, name: A, type: dance, stat: sweeps}\n", encoding="utf-8"
    )

    with pytest.raises(SeedError):
        read_seed_file(path)
