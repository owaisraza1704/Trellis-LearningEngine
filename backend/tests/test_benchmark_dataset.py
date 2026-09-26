from collections import Counter
import json
from pathlib import Path
import shutil

import pytest

from trellis_eval.dataset import load_dataset


DATASET = Path(__file__).resolve().parents[2] / "evaluation" / "datasets" / "v1"


def test_versioned_dataset_has_separate_balanced_splits_and_reviewable_labels():
    manifest, cases, sources = load_dataset(DATASET)
    assert len(cases) == 96 and len(sources) == 80
    categories = Counter(case["category"] for case in cases)
    assert len(categories) == 6 and set(categories.values()) == {16}
    assert manifest["split_counts"] == {"dev": 48, "test": 48}
    assert manifest["review_status"] == "pending_human_review"
    assert all(not item["human_reviewed"] for item in cases + list(sources.values()))
    assert sum(not case["gold_source_ids"] for case in cases) == 24
    for family in manifest["question_families"]:
        assert {case["split"] for case in cases if case["id"] in family["case_ids"]} == {
            family["split"]
        }


@pytest.mark.parametrize(
    "mutation, expected",
    [
        ("unknown_gold", "Unknown or unavailable"),
        ("duplicate_case", "unique"),
        ("cross_split_source", "remain separate"),
    ],
)
def test_corrupted_dataset_fails_before_model_calls(tmp_path, mutation, expected):
    shutil.copytree(DATASET, tmp_path / "dataset")
    directory = tmp_path / "dataset"
    cases = [json.loads(line) for line in (directory / "cases.jsonl").read_text().splitlines()]
    if mutation == "unknown_gold":
        cases[0]["gold_source_ids"] = ["not-in-the-corpus"]
    elif mutation == "duplicate_case":
        cases[1]["id"] = cases[0]["id"]
    else:
        first_test = next(case for case in cases if case["split"] == "test")
        first_test["source_ids"].append(cases[0]["source_ids"][0])
    (directory / "cases.jsonl").write_text("\n".join(json.dumps(case) for case in cases))
    with pytest.raises(ValueError, match=expected):
        load_dataset(directory)
