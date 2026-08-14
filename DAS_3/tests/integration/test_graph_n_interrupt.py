import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command
from langfuse.langchain import CallbackHandler
from das_agent.graph.state import State
from das_agent.graph.agent import route_decision 
from das_agent.nodes.nodes import (
    ask_clarification_node,
    get_intent_node,
    wait_for_clarification_node,
)

pytestmark = pytest.mark.integration
langfuse_handler = CallbackHandler()

def build_intent_clarification_subgraph():
    graph = StateGraph(State)
    graph.add_node("get_intent", get_intent_node)
    graph.add_node("ask_clarification", ask_clarification_node)
    graph.add_node("wait_for_clarification", wait_for_clarification_node)

    graph.add_edge(START, "get_intent")
    graph.add_conditional_edges(
        "get_intent",
        route_decision,
        {
            "create": END,
            "revise": END,
            "needs_clarification": "ask_clarification",
        },
    )
    graph.add_edge("ask_clarification", "wait_for_clarification")
    graph.add_edge("wait_for_clarification", "get_intent")

    return graph.compile(checkpointer=MemorySaver())


@pytest.fixture
def app():
    return build_intent_clarification_subgraph()


@pytest.fixture
def thread_config():
    return {"configurable": {"thread_id": "test-thread"}}


@pytest.mark.asyncio
async def test_intent_clarification_interrupts(app, thread_config):
    initial_state = {
        "messages": [HumanMessage(content="Make me a worksheet")],
        "qn_type": None,
        "topic": None,
        "difficulty": None,
    }

    first_result = await app.ainvoke(initial_state, config=thread_config)

    assert "__interrupt__" in first_result
    payload = first_result["__interrupt__"][0].value
    
    assert any("MCQ" in field or "Open-ended" in field for field in payload["awaiting"])
    assert any("topic" in field.lower() for field in payload["awaiting"])


@pytest.mark.asyncio
async def test_intent_clarification_resume(app, thread_config):
    initial_state = {
        "messages": [HumanMessage(content="Make me a worksheet")],
        "qn_type": None,
        "topic": None,
        "difficulty": None,
    }
    await app.ainvoke(initial_state, config=thread_config)

    final_result = await app.ainvoke(
        Command(resume="MCQ, medium difficulty, on Fractions, 10 questions"),
        config=thread_config,
    )


    assert "__interrupt__" not in final_result
    assert final_result["action"] == "create"
    assert final_result["qn_type"] == "MCQ"
    assert "fraction" in (final_result["topic"] or "").lower()
    assert final_result["pending_fields"] == []

