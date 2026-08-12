import pytest
from das_agent.nodes.nodes import ask_clarification_node


QN_TYPE_Q = "Would you like an MCQ or Open-ended worksheet?"
DIFFICULTY_Q = "What difficulty level: Easy, Medium, or Hard?"
TOPIC_Q = "What topic(s) should the worksheet focus on?"


@pytest.mark.asyncio
async def test_all_fields_missing():
    state = {}

    result = await ask_clarification_node(state)

    assert result["pending_fields"] == [QN_TYPE_Q, TOPIC_Q]
    msg = result["messages"][0].content
    assert QN_TYPE_Q in msg
    assert DIFFICULTY_Q not in msg
    assert TOPIC_Q in msg


@pytest.mark.asyncio
async def test_only_topic_missing():
    state = {
        "qn_type": "MCQ",
        "difficulty": "easy",
        "topic": "",
    }

    result = await ask_clarification_node(state)

    assert result["pending_fields"] == [TOPIC_Q]
    msg = result["messages"][0].content
    assert TOPIC_Q in msg
    assert QN_TYPE_Q not in msg
    assert DIFFICULTY_Q not in msg


@pytest.mark.asyncio
async def test_invalid_difficulty_does_not_require_clarification():
    state = {
        "qn_type": "Open_ended",
        "difficulty": "super-hard", 
        "topic": "Fractions",
    }

    result = await ask_clarification_node(state)

    assert result["pending_fields"] == []


@pytest.mark.asyncio
async def test_qn_type_and_topic_missing():
    state = {
        "difficulty": "hard",
        "topic": None,
    }

    result = await ask_clarification_node(state)

    assert result["pending_fields"] == [QN_TYPE_Q, TOPIC_Q]
    msg = result["messages"][0].content
    assert DIFFICULTY_Q not in msg


@pytest.mark.asyncio
async def test_nothing_missing_produces_empty_pending_fields():
    state = {
        "qn_type": "MCQ",
        "difficulty": "medium",
        "topic": "Algebra",
    }

    result = await ask_clarification_node(state)

    assert result["pending_fields"] == []
    msg = result["messages"][0].content
    assert "- " not in msg  


@pytest.mark.asyncio
async def test_custom_clarification_reason_used_as_intro():
    state = {
        "clarification_reason": "Your last answer was unclear.",
        "topic": "Geometry",
    }

    result = await ask_clarification_node(state)

    msg = result["messages"][0].content
    assert msg.startswith("Your last answer was unclear.")
    assert QN_TYPE_Q in msg
    assert DIFFICULTY_Q not in msg
    assert TOPIC_Q not in msg
