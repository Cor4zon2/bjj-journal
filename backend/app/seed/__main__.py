"""`python -m app.seed [--reset] [--file PATH]`"""

import argparse
from pathlib import Path

from app.db import get_sessionmaker
from app.seed.loader import DEFAULT_SEED_FILE, load_seed, read_seed_file


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the starting technique library.")
    parser.add_argument("--file", type=Path, default=DEFAULT_SEED_FILE, help="Seed YAML file")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete all techniques and positions first (loses notes and mastery levels!)",
    )
    args = parser.parse_args()

    seed = read_seed_file(args.file)
    with get_sessionmaker()() as db:
        result = load_seed(db, seed, reset=args.reset)
    print(
        f"Seed loaded: {result.positions_added} positions added, "
        f"{result.techniques_added} techniques added, "
        f"{result.techniques_skipped} already present."
    )


if __name__ == "__main__":
    main()
