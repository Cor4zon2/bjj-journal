"""Print the OpenAPI schema as JSON: `python -m app.openapi_dump > openapi.json`.

The frontend generates its TypeScript API types from this (see `npm run gen:api`).
"""

import json

from app.main import create_app


def main() -> None:
    print(json.dumps(create_app().openapi(), indent=2))


if __name__ == "__main__":
    main()
