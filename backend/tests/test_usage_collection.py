from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
import json
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi import HTTPException
import httpx
import openai
import pytest

from trellis import ai


def chat_response(usage=None, finish_reason="stop"):
    return SimpleNamespace(
        usage=usage,
        choices=[
            SimpleNamespace(
                finish_reason=finish_reason,
                message=SimpleNamespace(
                    parsed=ai.GeneralAnswer(
                        can_answer=True,
                        content="PRIVATE_ANSWER_TEXT",
                        reason="",
                    )
                ),
            )
        ],
    )


def embedding_response(count, usage=None):
    return SimpleNamespace(
        usage=usage,
        data=[
            SimpleNamespace(index=index, embedding=[float(index), 1.0])
            for index in reversed(range(count))
        ],
    )


@pytest.fixture
def provider(monkeypatch):
    client = SimpleNamespace(
        api_key="PRIVATE_TEST_CREDENTIAL",
        chat=SimpleNamespace(completions=SimpleNamespace(parse=Mock())),
        embeddings=SimpleNamespace(create=Mock()),
    )
    client.chat.completions.parse.return_value = chat_response(
        SimpleNamespace(prompt_tokens=11, completion_tokens=7, total_tokens=18),
    )
    monkeypatch.setattr(ai, "client_for", lambda provider: nullcontext(client))
    monkeypatch.setattr(ai, "embedding_profile", lambda: ("openai", "embedding-model", 2, "test:2"))
    return client


def complete(model="chat-model"):
    return ai.structured_completion(
        "openai",
        model,
        ai.GeneralAnswer,
        [
            {"role": "user", "content": "PRIVATE_PROMPT_TEXT"},
        ],
    )


def test_successful_chat_usage_records_counts_without_sensitive_content(provider):
    with ai.collect_usage() as events:
        answer = complete()
    assert answer.content == "PRIVATE_ANSWER_TEXT"
    assert len(events) == 1
    event = events[0]
    assert event == {
        "kind": "chat",
        "provider": "openai",
        "model": "chat-model",
        "operation": "GeneralAnswer",
        "seconds": event["seconds"],
        "input_tokens": 11,
        "output_tokens": 7,
        "total_tokens": 18,
    }
    assert event["seconds"] >= 0
    recorded = json.dumps(events)
    for private_value in ("PRIVATE_PROMPT_TEXT", "PRIVATE_ANSWER_TEXT", "PRIVATE_TEST_CREDENTIAL"):
        assert private_value not in recorded


@pytest.mark.parametrize("missing_attribute", [False, True])
def test_unknown_chat_usage_is_distinct_from_explicit_zero(provider, missing_attribute):
    missing = chat_response()
    if missing_attribute:
        del missing.usage
    provider.chat.completions.parse.side_effect = [
        missing,
        chat_response(SimpleNamespace(prompt_tokens=0, completion_tokens=0, total_tokens=0)),
    ]
    with ai.collect_usage() as events:
        complete()
        complete()
    assert len(events) == 2
    for field in ("input_tokens", "output_tokens", "total_tokens"):
        assert events[0][field] is None
        assert events[1][field] == 0


def test_partial_chat_usage_does_not_invent_missing_counts(provider):
    provider.chat.completions.parse.return_value = chat_response(SimpleNamespace(prompt_tokens=11))
    with ai.collect_usage() as events:
        complete()
    assert events[0]["input_tokens"] == 11
    assert events[0]["output_tokens"] is None
    assert events[0]["total_tokens"] is None


def test_embedding_usage_records_each_batch_and_retains_vector_order(provider):
    provider.embeddings.create.side_effect = [
        embedding_response(32, SimpleNamespace(prompt_tokens=64, total_tokens=64)),
        embedding_response(1, SimpleNamespace(prompt_tokens=2, total_tokens=2)),
    ]
    with ai.collect_usage() as events:
        vectors, profile = ai.embed_texts([f"Passage {index}" for index in range(33)])
    assert profile == "test:2"
    assert vectors == [[float(index), 1.0] for index in range(32)] + [[0.0, 1.0]]
    assert [len(call.kwargs["input"]) for call in provider.embeddings.create.call_args_list] == [
        32,
        1,
    ]
    assert [event["input_tokens"] for event in events] == [64, 2]
    assert [event["total_tokens"] for event in events] == [64, 2]
    assert all(
        event["kind"] == "embedding"
        and event["output_tokens"] == 0
        and event["operation"] == "embed_texts"
        and event["model"] == "embedding-model"
        and event["seconds"] >= 0
        for event in events
    )


def test_missing_embedding_usage_and_zero_usage_remain_distinct(provider):
    provider.embeddings.create.side_effect = [
        embedding_response(1),
        embedding_response(1, SimpleNamespace(prompt_tokens=0, total_tokens=0)),
    ]
    with ai.collect_usage() as events:
        ai.embed_texts(["One passage"])
        ai.embed_texts(["Another passage"])
    assert events[0]["input_tokens"] is None
    assert events[0]["total_tokens"] is None
    assert events[1]["input_tokens"] == 0
    assert events[1]["total_tokens"] == 0
    assert all(event["output_tokens"] == 0 for event in events)


def test_failed_chat_request_is_recorded_without_fabricated_token_counts(provider):
    provider.chat.completions.parse.side_effect = openai.APIConnectionError(
        request=httpx.Request("POST", "https://example.com/completions"),
    )
    with ai.collect_usage() as events:
        with pytest.raises(HTTPException) as error:
            complete()
    assert error.value.status_code == 503
    assert len(events) == 1
    assert events[0]["kind"] == "chat"
    assert events[0]["input_tokens"] is None
    assert events[0]["output_tokens"] is None
    assert events[0]["total_tokens"] is None


def test_rejected_chat_response_still_records_usage_already_consumed(provider):
    provider.chat.completions.parse.return_value = chat_response(
        SimpleNamespace(prompt_tokens=11, completion_tokens=20, total_tokens=31),
        finish_reason="length",
    )
    with ai.collect_usage() as events:
        with pytest.raises(HTTPException):
            complete()
    assert len(events) == 1
    assert events[0]["total_tokens"] == 31


def test_failed_embedding_batch_keeps_previous_usage_and_unknown_failed_attempt(provider):
    provider.embeddings.create.side_effect = [
        embedding_response(32, SimpleNamespace(prompt_tokens=64, total_tokens=64)),
        openai.APIConnectionError(request=httpx.Request("POST", "https://example.com/embeddings")),
    ]
    with ai.collect_usage() as events:
        with pytest.raises(HTTPException):
            ai.embed_texts(["Public passage"] * 33)
    assert len(events) == 2
    assert events[0]["total_tokens"] == 64
    assert events[1]["input_tokens"] is None
    assert events[1]["total_tokens"] is None
    assert events[1]["output_tokens"] == 0
    assert all(event["kind"] == "embedding" for event in events)


def test_collection_is_opt_in_and_nested_exceptions_restore_outer_collector(provider):
    complete("before-collection")
    with ai.collect_usage() as outer:
        complete("outer-before")
        with pytest.raises(RuntimeError, match="Stop inner operation"):
            with ai.collect_usage() as inner:
                complete("inner-only")
                raise RuntimeError("Stop inner operation")
        complete("outer-after")
    complete("after-collection")
    assert [event["model"] for event in outer] == ["outer-before", "outer-after"]
    assert [event["model"] for event in inner] == ["inner-only"]
    with ai.collect_usage() as later:
        assert later == []
        complete("later-collection")
    assert [event["model"] for event in later] == ["later-collection"]


def test_parallel_worker_collections_do_not_mix_usage(provider):
    ready = Barrier(2)

    def worker(model):
        with ai.collect_usage() as events:
            ready.wait(timeout=5)
            complete(model)
            ready.wait(timeout=5)
            complete(model)
        return events

    with ai.collect_usage() as parent:
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(worker, "worker-one")
            second = pool.submit(worker, "worker-two")
            first_events, second_events = first.result(timeout=10), second.result(timeout=10)
        complete("parent-only")
    assert [event["model"] for event in first_events] == ["worker-one", "worker-one"]
    assert [event["model"] for event in second_events] == ["worker-two", "worker-two"]
    assert [event["model"] for event in parent] == ["parent-only"]


def test_no_request_means_no_usage_event(provider):
    with ai.collect_usage() as events:
        with pytest.raises(HTTPException):
            complete("")
        assert ai.embed_texts([]) == ([], "test:2")
    assert events == []
    provider.chat.completions.parse.assert_not_called()
    provider.embeddings.create.assert_not_called()
