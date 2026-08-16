from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver

from das_agent.graph.agent import build_workflow
from das_agent.nodes import nodes
from das_agent.nodes.nodes import QuizIntent
from das_agent.worksheet.schemas import GeneratedMCQWorksheet, MCQWorksheetItem


pytestmark = pytest.mark.component


class RecordingRetriever:
    def __init__(self, *, result=None, error=None):
        self.result = [] if result is None else result
        self.error = error
        self.calls = []

    def retrieve_and_rerank(self, query):
        self.calls.append(query)
        if self.error:
            raise self.error
        return self.result


class RecordingLLM:
    def __init__(self, response):
        self.structured = MagicMock()
        self.structured.ainvoke = AsyncMock(return_value=response)

    def with_structured_output(self, *args, **kwargs):
        return self.structured


class IntentLLM:
    def __init__(self, response):
        self.structured = MagicMock()
        self.structured.ainvoke = AsyncMock(return_value=response)

    def with_structured_output(self, *args, **kwargs):
        return self.structured


def create_intent(*, question_count=15):
    return QuizIntent(
        action="create",
        has_sufficient_info=True,
        qn_type="MCQ",
        topic="grammar",
        difficulty="medium",
        question_count=question_count,
        revision_instruction=None,
        reason=None,
    )


def revise_intent():
    return QuizIntent(
        action="revise",
        has_sufficient_info=True,
        qn_type=None,
        topic=None,
        difficulty=None,
        question_count=None,
        revision_instruction="Make question 2 easier.",
        reason=None,
    )


def undersized_worksheet():
    return GeneratedMCQWorksheet(
        title="Too Short",
        readingPassage="A short grammar passage.",
        instructions="Choose the correct answer.",
        items=[
            MCQWorksheetItem(
                question="Which word is a noun?",
                options=["dog", "run", "quickly", "blue"],
                answer="dog",
            )
        ],
    )


@pytest.mark.asyncio
async def test_retrieval_failure_stops_complete_graph_before_generation():
    retriever = RecordingRetriever(error=RuntimeError("vector store unavailable"))
    worksheet_llm = RecordingLLM(undersized_worksheet())
    intent_llm = IntentLLM(create_intent())
    graph = build_workflow(retriever, worksheet_llm).compile()

    with patch.object(nodes, "ChatOpenRouter", return_value=intent_llm):
        with pytest.raises(RuntimeError, match="vector store unavailable"):
            await graph.ainvoke(
                {"messages": [HumanMessage(content="Create an MCQ on grammar")]}
            )

    assert retriever.calls == ["Create an MCQ on grammar"]
    worksheet_llm.structured.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
async def test_invalid_generation_exhausts_retry_in_complete_graph():
    retriever = RecordingRetriever(result=[])
    worksheet_llm = RecordingLLM(undersized_worksheet())
    intent_llm = IntentLLM(create_intent(question_count=15))
    graph = build_workflow(retriever, worksheet_llm).compile()

    with patch.object(nodes, "ChatOpenRouter", return_value=intent_llm):
        with pytest.raises(ValueError, match="exactly 15 questions"):
            await graph.ainvoke(
                {"messages": [HumanMessage(content="Create 15 MCQs on grammar")]}
            )

    assert retriever.calls == ["Create 15 MCQs on grammar"]
    assert worksheet_llm.structured.ainvoke.await_count == 2


@pytest.mark.asyncio
async def test_revision_without_worksheet_interrupts_without_downstream_calls():
    retriever = RecordingRetriever()
    worksheet_llm = RecordingLLM(undersized_worksheet())
    intent_llm = IntentLLM(revise_intent())
    graph = build_workflow(retriever, worksheet_llm).compile(
        checkpointer=InMemorySaver()
    )
    config = {"configurable": {"thread_id": "revision-without-worksheet"}}

    with patch.object(nodes, "ChatOpenRouter", return_value=intent_llm):
        result = await graph.ainvoke(
            {"messages": [HumanMessage(content="Make question 2 easier")]},
            config=config,
        )

    assert result["action"] == "clarify"
    assert "__interrupt__" in result
    assert "no current worksheet" in result["messages"][-1].content.lower()
    assert retriever.calls == []
    worksheet_llm.structured.ainvoke.assert_not_awaited()
