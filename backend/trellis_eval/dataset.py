"""Load immutable benchmark inputs without exposing reference labels to generation."""

from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BenchmarkInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Provenance(BenchmarkInput):
    type: Literal["curated_reference", "synthetic_fixture"]
    url: str | None
    note: str


class Passage(BenchmarkInput):
    id: str
    title: str
    text: str = Field(min_length=1, max_length=1600)
    kind: Literal["supplied", "web"]
    provenance: Provenance
    human_reviewed: bool


class History(BenchmarkInput):
    prompt: str
    content: str
    status: Literal["answered", "unverified", "abstained"]


class Case(BenchmarkInput):
    id: str
    category: Literal[
        "normal", "followup", "comparison", "conflict", "missing_evidence", "source_constraint"
    ]
    split: Literal["dev", "test"]
    question: str = Field(min_length=1)
    node_title: str
    node_description: str
    thread_title: str | None
    seed_context: str
    history: list[History]
    source_ids: list[str]
    web_source_ids: list[str]
    expected_answer: str = Field(min_length=1)
    gold_source_ids: list[str]
    expected_resolved_question: str | None
    expected_statuses: list[Literal["answered", "unverified", "abstained"]] = Field(min_length=1)
    sources_only: bool
    human_reviewed: bool


def load_dataset(directory: Path) -> tuple[dict, list[dict], dict[str, dict]]:
    manifest = json.loads((directory / "manifest.json").read_text())
    source_bytes = (directory / "sources.jsonl").read_bytes()
    case_bytes = (directory / "cases.jsonl").read_bytes()
    passages = [
        Passage.model_validate_json(line).model_dump() for line in source_bytes.splitlines() if line
    ]
    cases = [
        Case.model_validate_json(line).model_dump() for line in case_bytes.splitlines() if line
    ]
    sources = {item["id"]: item for item in passages}
    if len(sources) != len(passages) or len({case["id"] for case in cases}) != len(cases):
        raise ValueError("Dataset IDs must be unique")
    for case in cases:
        available = set(case["source_ids"] + case["web_source_ids"])
        if not available <= sources.keys() or not set(case["gold_source_ids"]) <= available:
            raise ValueError(f"Unknown or unavailable reference passage in {case['id']}")
        for key, kind in (("source_ids", "supplied"), ("web_source_ids", "web")):
            if len(case[key]) != len(set(case[key])) or any(
                sources[id]["kind"] != kind for id in case[key]
            ):
                raise ValueError(f"Duplicate or incorrectly classified sources in {case['id']}")
    if manifest["case_count"] != len(cases) or manifest["source_count"] != len(sources):
        raise ValueError("Manifest counts do not match the dataset")
    if manifest["category_counts"] != dict(Counter(case["category"] for case in cases)):
        raise ValueError("Manifest category counts do not match")
    if manifest["split_counts"] != dict(Counter(case["split"] for case in cases)):
        raise ValueError("Manifest split counts do not match")
    split_sources = {
        split: {
            id
            for case in cases
            if case["split"] == split
            for id in case["source_ids"] + case["web_source_ids"]
        }
        for split in ("dev", "test")
    }
    if split_sources["dev"] & split_sources["test"]:
        raise ValueError("Development and test passages must remain separate")
    return (
        {
            **manifest,
            "dataset_sha256": sha256(case_bytes).hexdigest(),
            "source_sha256": sha256(source_bytes).hexdigest(),
        },
        cases,
        sources,
    )
