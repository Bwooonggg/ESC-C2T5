import pytest
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from das_agent.nodes.nodes import ask_clarification_node, wait_for_clarification_node
from das_agent.graph.state import State


def build_clarification_subgraph():
    """A focused two-node graph isolating just the interrupt/resume cycle,
    so we can integration-test it without needing a real LLM or retriever."""
    graph = StateGraph(State)
    graph.add_node("ask_clarification", ask_clarification_node)
    graph.add_node("wait_for_clarification", wait_for_clarification_node)
    graph.add_edge(START, "ask_clarification")
    graph.add_edge("ask_clarification", "wait_for_clarification")
    graph.add_edge("wait_for_clarification", END)
    return graph.compile(checkpointer=MemorySaver())


@pytest.fixture
def clarification_app():
    return build_clarification_subgraph()


@pytest.fixture
def thread_config():
    return {"configurable": {"thread_id": "test-thread"}}


@pytest.mark.asyncio
async def test_pause_fields(clarification_app, thread_config):
    initial_state = {"qn_type": None, "topic": None, "difficulty": None}

    result = await clarification_app.ainvoke(initial_state, config=thread_config)

    assert "__interrupt__" in result
    payload = result["__interrupt__"][0].value
    assert payload["awaiting"] == [
        "Would you like an MCQ or Open-ended worksheet?",
        "What topic(s) should the worksheet focus on?",
    ]


@pytest.mark.asyncio
async def test_dict_resume(clarification_app, thread_config):
    initial_state = {"qn_type": None, "topic": None, "difficulty": None}
    await clarification_app.ainvoke(initial_state, config=thread_config)

    result = await clarification_app.ainvoke(
        Command(resume={"qn_type": "MCQ", "difficulty": "hard"}),
        config=thread_config,
    )

    assert result["pending_fields"] == []
    assert result["messages"][-1].content == "qn_type: MCQ, difficulty: hard"



@pytest.mark.asyncio
async def test_free_text_resume(clarification_app, thread_config):
    initial_state = {"qn_type": None, "topic": None, "difficulty": None}
    await clarification_app.ainvoke(initial_state, config=thread_config)

    result = await clarification_app.ainvoke(
        Command(resume="I'd like a medium difficulty MCQ please"),
        config=thread_config,
    )

    assert result["messages"][-1].content == "I'd like a medium difficulty MCQ please"
    assert result["pending_fields"] == []


@pytest.mark.asyncio
async def test_combined_reply(clarification_app, thread_config):
    initial_state = {
        "qn_type": None,
        "topic": None,
        "difficulty": None,
        "query": "Create 8 questions about subject-verb agreement",
    }
    await clarification_app.ainvoke(initial_state, config=thread_config)

    result = await clarification_app.ainvoke(
        Command(resume="Make it MCQ"), config=thread_config
    )

    assert result["clarification_query"] == (
        "Create 8 questions about subject-verb agreement\nMake it MCQ"
    )


@pytest.mark.asyncio
async def test_double_resume(
    clarification_app, thread_config
):
    """Regression guard: resuming a thread that isn't currently interrupted
    should not silently reuse stale state."""
    initial_state = {"qn_type": None, "topic": None, "difficulty": None}
    await clarification_app.ainvoke(initial_state, config=thread_config)
    first = await clarification_app.ainvoke(Command(resume="Make it MCQ"), config=thread_config)
    assert "__interrupt__" not in first 
