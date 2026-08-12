import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

import das_agent.nodes.nodes as nodes_module
from das_agent.nodes.nodes import (
    QuizIntent,
    RetrieveAndRerankNode,
    get_intent_node,
)
from das_agent.graph.agent import route_decision
from das_agent.graph.agent import build_workflow
from das_agent.worksheet.schemas import GeneratedMCQWorksheet, MCQWorksheetItem

class FakeRetriever:

    def __init__(self, docs):
        self._docs = docs
        self.calls = []

    def retrieve_and_rerank(self, query):
        self.calls.append(query)
        return self._docs


class _FakeStructuredRunnable:

    def __init__(self, owner):
        self._owner = owner

    def invoke(self, messages, config=None, **kwargs):
        return next(self._owner._responses)

    async def ainvoke(self, messages, config=None, **kwargs):
        return next(self._owner._responses)


class FakeStructuredLLM:

    def __init__(self, *responses):
        self._responses = iter(responses)

    def with_structured_output(self, schema, *, method=None, strict=None, include_raw=False, **kwargs):
        return _FakeStructuredRunnable(self)


def _quiz_intent(**overrides):
    defaults = dict(
        has_sufficient_info=True,
        qn_type="MCQ",
        topic="Fractions",
        difficulty="medium",
        reason=None,
    )
    defaults.update(overrides)
    return QuizIntent(**defaults)


def _mcq_worksheet(count, topic):
    items = []
    for i in range(count):
        options = [f"Option {i}-{j}" for j in range(4)]
        items.append(
            MCQWorksheetItem(question=f"Q{i} about {topic}?", options=options, answer=options[i % 4])
        )
    return GeneratedMCQWorksheet(
        title=f"{topic} Worksheet",
        readingPassage="A short passage.",
        instructions="Answer each question.",
        items=items,
    )



@pytest.mark.asyncio
async def test_full_workflow_generates_worksheet_when_intent_is_immediately_clear(monkeypatch):
    fake_intent_llm = FakeStructuredLLM(_quiz_intent(qn_type="MCQ", topic="Fractions", difficulty="easy"))
    monkeypatch.setattr(nodes_module, "ChatOpenRouter", lambda **kwargs: fake_intent_llm)

    worksheet_llm = FakeStructuredLLM(_mcq_worksheet(4, "Fractions"))
    retriever = FakeRetriever([])

    graph = build_workflow(retriever, worksheet_llm).compile()
    result = await graph.ainvoke(
        {"messages": [HumanMessage(content="Create 4 MCQ questions on Fractions")]}
    )

    assert "generated_worksheet" in result
    assert result["generated_worksheet"]["title"] == "Fractions Worksheet"
    assert len(result["generated_worksheet"]["items"]) == 4


@pytest.mark.asyncio
async def test_full_workflow_loops_back_through_get_intent_after_clarification(monkeypatch):
    fake_intent_llm = FakeStructuredLLM(
        _quiz_intent(has_sufficient_info=False, qn_type=None, topic=None, reason="Missing topic and format."),
        _quiz_intent(qn_type="MCQ", topic="Subject-Verb Agreement", difficulty="medium"),
    )
    monkeypatch.setattr(nodes_module, "ChatOpenRouter", lambda **kwargs: fake_intent_llm)

    worksheet_llm = FakeStructuredLLM(_mcq_worksheet(5, "Subject-Verb Agreement"))
    retriever = FakeRetriever([])

    checkpointer = MemorySaver()
    graph = build_workflow(retriever, worksheet_llm).compile(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": "loop-back-thread"}}

    first = await graph.ainvoke(
        {"messages": [HumanMessage(content="I want a worksheet please")]}, config=config
    )
    assert "__interrupt__" in first
    assert "generated_worksheet" not in first

    second = await graph.ainvoke(
        Command(resume="5 MCQ on Subject-Verb Agreement please"), config=config
    )

    assert "generated_worksheet" in second
    assert second["generated_worksheet"]["title"] == "Subject-Verb Agreement Worksheet"
    assert len(second["generated_worksheet"]["items"]) == 5