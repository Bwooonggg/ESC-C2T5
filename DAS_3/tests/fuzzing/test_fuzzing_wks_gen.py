import pytest
from hypothesis import given, settings, HealthCheck, strategies as st
from unittest.mock import AsyncMock, MagicMock

from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver

import das_agent.nodes.nodes as nodes_module
from das_agent.nodes.nodes import get_question_count
from das_agent.graph.agent import build_workflow
from das_agent.worksheet.schemas import (
    GeneratedMCQWorksheet,
    GeneratedOpenEndedWorksheet,
    MCQWorksheetItem,
    OpenEndedWorksheetItem,
)


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


def _fake_intent_llm(monkeypatch, qn_type, topic, sufficient=True, reason=None):
    fake_result = MagicMock()
    fake_result.has_sufficient_info = sufficient
    fake_result.qn_type = qn_type if sufficient else None
    fake_result.topic = topic if sufficient else None
    fake_result.difficulty = "medium"
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
    user_prompt, qn_type, topic, _count = data
    _fake_intent_llm(monkeypatch, qn_type=qn_type, topic=topic)
    expected_count = get_question_count(user_prompt)

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

    worksheet_llm = _make_worksheet_llm("MCQ", get_question_count(user_prompt))
    retriever = _make_retriever()

    checkpointer = MemorySaver()
    graph = build_workflow(retriever, worksheet_llm).compile(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": f"fuzz-{hash(user_prompt)}"}}

    result = await graph.ainvoke(
        {"messages": [HumanMessage(content=user_prompt)]}, config=config
    )

    assert "generated_worksheet" not in result
    assert result.get("__interrupt__")




@given(st.integers(min_value=1, max_value=100))
def test_get_question_count_extracts_explicit_number(n):
    text = f"Create {n} MCQ questions on Sight Words."
    assert get_question_count(text) == n


@given(st.text(min_size=0, max_size=50).filter(lambda s: not any(c.isdigit() for c in s)))
def test_get_question_count_defaults_when_no_number(text):
    assert get_question_count(text) == 15