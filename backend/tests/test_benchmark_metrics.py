import copy
import importlib.util

import pytest

if importlib.util.find_spec("deepeval") is None:
    pytest.skip("Install the evaluation dependency group to test judge metrics.", allow_module_level=True)

from trellis import ai
from trellis_eval.metrics import evaluate_metrics


CASE = {
    "question": "What does list.append return?",
    "node_title": "Python sequences",
    "thread_title": "Mutating lists",
    "expected_statuses": ["answered"],
    "expected_answer": "list.append adds one item in place and returns None.",
    "expected_resolved_question": None,
}
RESPONSE = {
    "status": "answered",
    "content": "list.append returns None.\n\n[1]",
    "evidence": [{"excerpt": "list.append mutates a list in place and returns None."}],
}


def evaluate(case=None, response=None, resolved_question=""):
    return evaluate_metrics(
        case or CASE, response or RESPONSE, resolved_question, provider="azure", model="test-judge",
    )


def test_expected_abstention_and_absent_thread_are_not_judged(monkeypatch):
    monkeypatch.setattr(ai, "structured_completion", lambda *args: pytest.fail("No judge needed"))
    result = evaluate(
        {**CASE, "expected_statuses": ["abstained"], "expected_answer": ""},
        {"status": "abstained", "content": "Insufficient evidence.", "evidence": []},
    )
    assert all(metric["score"] is None for metric in result.values())
    assert all(metric["error"] is None for metric in result.values())


def test_required_answer_withheld_is_zero_without_judge(monkeypatch):
    monkeypatch.setattr(ai, "structured_completion", lambda *args: pytest.fail("No judge needed"))
    result = evaluate(response={"status": "abstained", "content": "Insufficient evidence.", "evidence": []})
    assert result["answer_correctness"]["score"] == 0
    assert result["citation_precision"]["score"] is None


def test_unverified_answer_is_graded_against_reference_once(monkeypatch):
    calls = []

    def complete(provider, model, schema, messages):
        calls.append(messages[-1]["content"])
        assert (provider, model) == ("azure", "test-judge")
        return schema(score=8, reason="The return value is correct; mutation was omitted.")

    monkeypatch.setattr(ai, "structured_completion", complete)
    result = evaluate(response={**RESPONSE, "status": "unverified", "evidence": []})
    assert len(calls) == 1
    assert CASE["expected_answer"] in calls[0]
    assert result["answer_correctness"]["score"] == 0.8
    assert result["citation_precision"]["score"] is None


def test_citation_precision_uses_only_linked_passage_and_counts_invalid_links(monkeypatch):
    case = {**CASE, "expected_statuses": ["abstained"]}
    response = copy.deepcopy(RESPONSE)
    response["content"] = (
        "list.append returns None.\n\n```python\n[99]\n```\n\n[2] [1]\n\n"
        "list.sort sorts in place.\n\n[3] [8]"
    )
    response["evidence"] = [
        {"excerpt": "UNRELATED: strings are immutable."},
        {"excerpt": "APPEND: list.append returns None."},
        {"excerpt": "SORT: list.sort sorts in place."},
    ]
    calls = []

    def complete(provider, model, schema, messages):
        prompt = messages[-1]["content"]
        calls.append(prompt)
        expected = ["APPEND:", "UNRELATED:", "SORT:"][len(calls) - 1]
        assert expected in prompt
        assert sum(marker in prompt for marker in ("APPEND:", "UNRELATED:", "SORT:")) == 1
        assert CASE["expected_answer"] not in prompt
        if len(calls) <= 2:
            assert "[99]" in prompt
            assert "list.sort sorts in place." not in prompt
        else:
            assert "list.append returns None." not in prompt
        return schema(score=0 if expected == "UNRELATED:" else 1, reason=expected)

    monkeypatch.setattr(ai, "structured_completion", complete)
    result = evaluate(case, response)["citation_precision"]
    assert len(calls) == 3
    assert result["supported_citations"] == 2
    assert result["total_citations"] == 4
    assert result["score"] == 0.5
    assert "[8]" in result["reason"]


def test_answer_without_citations_has_zero_precision(monkeypatch):
    monkeypatch.setattr(ai, "structured_completion", lambda *args: pytest.fail("No judge needed"))
    result = evaluate(
        {**CASE, "expected_statuses": ["abstained"]},
        {**RESPONSE, "content": "A factual claim without a citation."},
    )["citation_precision"]
    assert result["score"] == 0
    assert result["supported_citations"] == result["total_citations"] == 0


def test_judge_failures_are_safe_and_do_not_prevent_other_metrics(monkeypatch):
    case = {**CASE, "expected_resolved_question": "What does Python list.append return?"}
    calls = []

    def complete(provider, model, schema, messages):
        calls.append(messages)
        if len(calls) <= 2:
            raise RuntimeError("Secret provider token and private request body")
        return schema(score=10, reason="The intended thread question is preserved.")

    monkeypatch.setattr(ai, "structured_completion", complete)
    result = evaluate(case, resolved_question="What does append return in Python?")
    assert len(calls) == 3
    assert result["answer_correctness"]["score"] is None
    assert result["answer_correctness"]["error"]
    assert result["citation_precision"]["score"] is None
    assert result["citation_precision"]["supported_citations"] is None
    assert result["citation_precision"]["total_citations"] == 1
    assert result["thread_context"]["score"] == 1
    assert "Secret" not in str(result)


@pytest.mark.parametrize("score", [0.5, 2, float("nan")])
def test_invalid_binary_judgments_are_unavailable_not_silently_coerced(monkeypatch, score):
    monkeypatch.setattr(
        ai, "structured_completion",
        lambda provider, model, schema, messages: schema(score=score, reason="Invalid score fixture."),
    )
    result = evaluate({**CASE, "expected_statuses": ["abstained"]})["citation_precision"]
    assert result["score"] is None
    assert result["supported_citations"] is None
    assert result["error"]
