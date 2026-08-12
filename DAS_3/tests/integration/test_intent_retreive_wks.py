import pytest
from langgraph.graph import StateGraph, START, END

from das_agent.graph.agent import route_decision 

from das_agent.nodes.nodes import (
    RetrieveAndRerankNode,
    WorksheetAgentNode,
    ask_clarification_node,
    wait_for_clarification_node,
)
from das_agent.graph.state import State
from das_agent.worksheet.schemas import GeneratedMCQWorksheet, MCQWorksheetItem


def _to_mcq_worksheet(payload: dict) -> GeneratedMCQWorksheet:
    items = [MCQWorksheetItem(**item) for item in payload["items"]]
    return GeneratedMCQWorksheet(
        title=payload["title"],
        readingPassage=payload.get("readingPassage", "A short passage."),
        instructions=payload.get("instructions", "Answer the following."),
        items=items,
    )


class _FakeStructuredRunnable:
    def __init__(self, responses):
        self._responses = iter(responses)

    def invoke(self, messages, config=None, **kwargs):
        return next(self._responses)

    async def ainvoke(self, messages, config=None, **kwargs):
        return next(self._responses)


class FakeWorksheetLLM:
    def __init__(self, *json_payloads):
        self._responses = [_to_mcq_worksheet(p) for p in json_payloads]

    def with_structured_output(self, schema, *, method=None, strict=None, include_raw=False, **kwargs):
        return _FakeStructuredRunnable(self._responses)


class _FakeDoc:
    def __init__(self, page_content):
        self.page_content = page_content


class FakeKnowledgeBaseRetriever:

    def __init__(self, docs):
        self._docs = [_FakeDoc(d) if isinstance(d, str) else d for d in docs]
        self.calls = []

    def retrieve_and_rerank(self, query):
        self.calls.append(query)
        return self._docs


def make_fake_get_intent_node(qn_type, topic, difficulty="easy", question_count=1, reason=None):

    async def fake_get_intent_node(state: State):
        return {
            "qn_type": qn_type,
            "topic": topic,
            "question_count": question_count,
            "difficulty": difficulty,
            "query": state.get("query", ""),
            "clarification_reason": reason,
            "clarification_query": None,
        }

    return fake_get_intent_node


def build_test_workflow(fake_get_intent_node, retriever, worksheet_llm):
    workflow = StateGraph(State)

    workflow.add_node("retrieve_and_rerank", RetrieveAndRerankNode(retriever))
    workflow.add_node("get_intent", fake_get_intent_node)
    workflow.add_node("worksheet_agent", WorksheetAgentNode(worksheet_llm))
    workflow.add_node("ask_clarification", ask_clarification_node)
    workflow.add_node("wait_for_clarification", wait_for_clarification_node)

    workflow.add_edge(START, "get_intent")
    workflow.add_conditional_edges(
        "get_intent",
        route_decision,
        {
            "ready": "retrieve_and_rerank",
            "needs_clarification": "ask_clarification",
        },
    )
    workflow.add_edge("ask_clarification", "wait_for_clarification")
    workflow.add_edge("wait_for_clarification", "get_intent")
    workflow.add_edge("retrieve_and_rerank", "worksheet_agent")
    workflow.add_edge("worksheet_agent", END)

    return workflow.compile()



@pytest.mark.asyncio
async def test_full_workflow_ready_path_produces_worksheet():
    fake_get_intent = make_fake_get_intent_node(qn_type="MCQ", topic="Fractions")
    retriever = FakeKnowledgeBaseRetriever(docs=["doc about fractions"])
    worksheet_llm = FakeWorksheetLLM({
        "title": "Fractions Basics",
        "items": [
            {"question": "What is 1/2 + 1/4?", "options": ["1/4", "3/4", "1/2", "1"], "answer": "3/4"},
        ],
    })

    graph = build_test_workflow(fake_get_intent, retriever, worksheet_llm)

    initial_state = {
        "messages": [],
        "query": "Make me a 1 question MCQ worksheet on fractions",
        "qn_type": None,
        "topic": None,
        "difficulty": None,
        "question_count": None,
        "rankedDocs": [],
    }

    result = await graph.ainvoke(initial_state)
    assert not any(
        "clarif" in getattr(m, "content", "").lower()
        for m in result.get("messages", [])
    )


    assert retriever.calls == ["Make me a 1 question MCQ worksheet on fractions"]
    assert [doc.page_content for doc in result["rankedDocs"]] == ["doc about fractions"]


    assert result["generated_worksheet"]["title"] == "Fractions Basics"
    assert "1 questions" in result["messages"][-1].content


@pytest.mark.asyncio
async def test_full_workflow_missing_topic_routes_to_clarification():
    fake_get_intent = make_fake_get_intent_node(qn_type="MCQ", topic=None)

    class ExplodingRetriever:
        def retrieve_and_rerank(self, query):
            raise AssertionError("retrieve_and_rerank should not run without a topic")

    class _ExplodingRunnable:
        def invoke(self, *a, **k):
            raise AssertionError("worksheet_agent should not run without a topic")

        async def ainvoke(self, *a, **k):
            raise AssertionError("worksheet_agent should not run without a topic")

    class ExplodingLLM:
        def with_structured_output(self, schema, *, method=None, strict=None, include_raw=False, **kwargs):
            return _ExplodingRunnable()

    graph = build_test_workflow(fake_get_intent, ExplodingRetriever(), ExplodingLLM())

    initial_state = {
        "messages": [],
        "query": "make me a worksheet",
        "qn_type": None,
        "topic": None,
        "difficulty": None,
        "question_count": None,
        "rankedDocs": [],
    }

    result = await graph.ainvoke(initial_state)

    assert "generated_worksheet" not in result
    assert any(
        "clarif" in getattr(m, "content", "").lower()
        or "topic" in getattr(m, "content", "").lower()
        for m in result.get("messages", [])
    )