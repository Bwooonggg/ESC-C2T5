from unittest.mock import patch

import pytest

from das_agent.nodes.nodes import wait_for_clarification_node


@pytest.fixture
def base_state():
    return {
        "pending_fields": [
            "Would you like an MCQ or Open-ended worksheet?",
            "What difficulty level: Easy, Medium, or Hard?",
        ],
        "qn_type": None,
        "difficulty": None,
        "topic": None,
    }

@pytest.mark.asyncio
async def test_all_fields_provided(base_state):
    with patch("das_agent.nodes.nodes.interrupt",
                return_value={"qn_type": "MCQ", "difficulty": "hard"}) as mock_interrupt, \
            patch("das_agent.nodes.nodes.ChatOpenRouter") as mock_llm_cls:

        result = await wait_for_clarification_node(base_state)

        mock_interrupt.assert_called_once_with({"awaiting": base_state["pending_fields"]})
        mock_llm_cls.assert_not_called()

        assert "qn_type" not in result
        assert "difficulty" not in result
        assert result["pending_fields"] == []
        assert result["messages"][0].content == "qn_type: MCQ, difficulty: hard"

@pytest.mark.asyncio
async def test_partial_fields_provided(base_state):
    base_state["difficulty"] = "easy" 
    with patch("das_agent.nodes.nodes.interrupt", return_value={"qn_type": "Open_ended"}), \
            patch("das_agent.nodes.nodes.ChatOpenRouter") as mock_llm_cls:

        result = await wait_for_clarification_node(base_state)

        mock_llm_cls.assert_not_called()
        assert "qn_type" not in result
        assert "difficulty" not in result

@pytest.mark.asyncio
async def test_no_fields_provided_falls_back_to_state(base_state):
    with patch("das_agent.nodes.nodes.interrupt", return_value={}), \
            patch("das_agent.nodes.nodes.ChatOpenRouter") as mock_llm_cls:

        result = await wait_for_clarification_node(base_state)

        mock_llm_cls.assert_not_called()
        assert "qn_type" not in result
        assert "difficulty" not in result

@pytest.mark.asyncio
async def test_dict_reply_is_persisted_for_intent_detection(base_state):
    with patch("das_agent.nodes.nodes.interrupt",
                return_value={"qn_type": "MCQ", "difficulty": "hard", "topic": "fractions"}), \
            patch("das_agent.nodes.nodes.ChatOpenRouter"):

        result = await wait_for_clarification_node(base_state)

        assert result["messages"][0].content == (
            "qn_type: MCQ, difficulty: hard, topic: fractions"
        )
        assert "topic" not in result


@pytest.mark.asyncio
async def test_free_text_contains_all_requirements(base_state):
    with patch("das_agent.nodes.nodes.interrupt",
                return_value="I'd like a medium difficulty MCQ please"), \
            patch("das_agent.nodes.nodes.ChatOpenRouter") as mock_llm_cls:

        result = await wait_for_clarification_node(base_state)

        mock_llm_cls.assert_not_called()
        assert "qn_type" not in result
        assert "difficulty" not in result
        assert result["pending_fields"] == []
        assert result["messages"][0].content == "I'd like a medium difficulty MCQ please"

@pytest.mark.asyncio
async def test_free_text_contains_partial_requirements(base_state):
    with patch("das_agent.nodes.nodes.interrupt", return_value="make it open ended"), \
            patch("das_agent.nodes.nodes.ChatOpenRouter") as mock_llm_cls:

        result = await wait_for_clarification_node(base_state)

        mock_llm_cls.assert_not_called()
        assert "qn_type" not in result
        assert "difficulty" not in result

@pytest.mark.asyncio
async def test_free_text_nonsense_input(base_state):
    with patch("das_agent.nodes.nodes.interrupt", return_value="asdkjhasdkjh banana"), \
            patch("das_agent.nodes.nodes.ChatOpenRouter") as mock_llm_cls:

        result = await wait_for_clarification_node(base_state)

        mock_llm_cls.assert_not_called()
        assert "qn_type" not in result
        assert "difficulty" not in result
        assert result["messages"][0].content == "asdkjhasdkjh banana"

@pytest.mark.asyncio
async def test_topic_is_not_carried_over_from_free_text_reply(base_state):
    with patch("das_agent.nodes.nodes.interrupt",
                return_value="hard MCQ about photosynthesis please"), \
            patch("das_agent.nodes.nodes.ChatOpenRouter") as mock_llm_cls:

        result = await wait_for_clarification_node(base_state)

        mock_llm_cls.assert_not_called()
        assert "topic" not in result


@pytest.mark.asyncio
async def test_reply_is_combined_with_original_query(base_state):
    base_state["query"] = "Create 8 questions about subject-verb agreement"

    with patch("das_agent.nodes.nodes.interrupt", return_value="Make it MCQ"):
        result = await wait_for_clarification_node(base_state)

    assert result["clarification_query"] == (
        "Create 8 questions about subject-verb agreement\nMake it MCQ"
    )
