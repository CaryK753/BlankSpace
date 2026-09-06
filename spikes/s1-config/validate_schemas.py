from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource


ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "packages" / "contracts" / "schemas"


def load(name: str) -> dict:
    return json.loads((SCHEMA_DIR / name).read_text(encoding="utf-8"))


shared = load("shared.schema.json")
registry = Registry().with_resource(shared["$id"], Resource.from_contents(shared))
schemas = {
    "product-config": load("product-config.schema.json"),
    "product-manifest": load("product-manifest.schema.json"),
    "module": load("module.schema.json"),
}

cases = {
    "product-config": {
        "valid": {
            "schemaVersion": "1",
            "preset": "workspace-saas",
            "product": "./product",
            "targets": ["web", "server"],
            "kits": {"workspace": {}},
            "serviceProviders": {"blankspace.database": "@blankspace/adapter-postgres"},
            "enabledFeatures": ["projects/files"],
        },
        "invalid": [
            {"schemaVersion": "1", "product": "./../outside", "targets": ["web"]},
            {"schemaVersion": "1", "product": "./product\\..\\outside", "targets": ["web"]},
            {"schemaVersion": "1", "product": "./product/./nested", "targets": ["web"]},
            {"schemaVersion": "1", "product": "./product", "targets": ["desktop"]},
            {"schemaVersion": "1", "product": "./product", "targets": ["web"], "serviceProviders": {"blankspace.database": "Bad Package"}},
            {"schemaVersion": "1", "product": "./product", "targets": ["web"], "enabledFeatures": ["files"]},
            {"schemaVersion": "1", "product": "./product", "targets": ["web"], "extra": True},
        ],
    },
    "product-manifest": {
        "valid": {
            "schemaVersion": "1",
            "entries": {"web": "./frontend/index.ts"},
            "modules": ["./modules/projects"],
        },
        "invalid": [
            {"schemaVersion": "1", "entries": {"desktop": "./desktop.ts"}},
            {"schemaVersion": "2"},
        ],
    },
    "module": {
        "valid": {
            "schemaVersion": "1",
            "id": "projects",
            "requires": ["blankspace.workspace@^1"],
            "optional": [{"service": "blankspace.files@^1", "feature": "files"}],
            "entries": {"web": "./frontend/index.ts", "server": "./backend/index.ts"},
        },
        "invalid": [
            {"schemaVersion": "1", "id": "Projects", "entries": {"web": "./index.ts"}},
            {"schemaVersion": "1", "id": "projects", "entries": {"web": "./../outside.ts"}},
            {"schemaVersion": "1", "id": "projects", "entries": {"web": "./module\\..\\outside.ts"}},
            {"schemaVersion": "1", "id": "projects", "entries": {}},
        ],
    },
}


def main() -> None:
    checked = 0
    for name, schema in schemas.items():
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema, registry=registry)
        validator.validate(cases[name]["valid"])
        checked += 1
        for invalid in cases[name]["invalid"]:
            errors = list(validator.iter_errors(invalid))
            if not errors:
                raise AssertionError(f"{name} unexpectedly accepted {invalid!r}")
            checked += 1
    print(f"validated {checked} schema corpus cases")


if __name__ == "__main__":
    main()
