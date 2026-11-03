"""Validation for the technique prerequisite graph."""

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import technique_prereq


class PrereqError(ValueError):
    pass


def check_prereqs(db: Session, technique_id: int | None, prereq_ids: list[int]) -> None:
    """Reject self-references and cycles (A needs B, B needs A).

    `technique_id` is `None` for a technique that does not exist yet; a new node
    cannot close a cycle, so only self-reference is impossible there too.
    """
    if technique_id is None:
        return
    if technique_id in prereq_ids:
        raise PrereqError("A technique cannot be its own prerequisite")

    graph: dict[int, set[int]] = defaultdict(set)
    for tech, prereq in db.execute(
        select(technique_prereq.c.technique_id, technique_prereq.c.prereq_id)
    ):
        if tech != technique_id:
            graph[tech].add(prereq)
    graph[technique_id] = set(prereq_ids)

    # Is technique_id reachable from any of its new prerequisites?
    stack = list(prereq_ids)
    seen: set[int] = set()
    while stack:
        node = stack.pop()
        if node == technique_id:
            raise PrereqError("These prerequisites would create a cycle")
        if node in seen:
            continue
        seen.add(node)
        stack.extend(graph[node])
