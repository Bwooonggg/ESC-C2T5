import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from das_agent.nodes.nodes import QuizIntent, ask_clarification_node, get_intent_node, get_question_count
from langchain_core.messages import HumanMessage
from das_agent.nodes import nodes
from das_agent.graph.agent import route_decision

def make_fake_extracted_info():
    return [
        {"content": "Multisensory teaching approaches, such as Orton-Gillingham, combine visual, "
            "auditory, and kinesthetic-tactile pathways to help learners with dyslexia "
            "build stronger connections between letters and sounds.", "source": "teaching_strategies.pdf"},
            {"content": "Grammar skills, including subject-verb agreement, verb tense consistency, "
            "and correct use of articles and pronouns, are often challenging for learners "
            "with dyslexia due to underlying difficulties with working memory and "
            "processing language structure.", "source": "grammar_fundamentals.pdf"}
    ]

def make_state(query: str) -> dict:
    return {"messages": [HumanMessage(content=query)]}

def patch_structured_llm(quiz_intent: QuizIntent):
    mock_llm_instance = MagicMock()
    mock_structured = MagicMock()
    mock_structured.ainvoke = AsyncMock(return_value=quiz_intent)
    mock_llm_instance.with_structured_output.return_value = mock_structured
    return patch.object(nodes, "ChatOpenRouter", return_value=mock_llm_instance)

@pytest.mark.asyncio
async def test_get_intent_success_detects_intent_and_updates_state():
    fake_result = QuizIntent(
        has_sufficient_info=True,
        qn_type="MCQ",
        topic="grammar",
        difficulty="medium",
    )
    state = make_state("quiz me on grammar")
 
    with patch_structured_llm(fake_result):
        result = await get_intent_node(state)
 
    assert result["qn_type"] == "MCQ"
    assert result["topic"] == "grammar"
    assert result["difficulty"] == "medium"
    assert result["question_count"] == 15
    assert result["query"] == "quiz me on grammar"


@pytest.mark.asyncio
async def test_get_intent_uses_configured_openrouter_model(monkeypatch):
    fake_result = QuizIntent(
        has_sufficient_info=True,
        qn_type="MCQ",
        topic="grammar",
        difficulty="medium",
    )
    monkeypatch.setenv("OPENROUTER_MODEL", "provider/test-model")

    with patch_structured_llm(fake_result) as openrouter:
        await get_intent_node(make_state("quiz me on grammar"))

    openrouter.assert_called_once_with(
        model="provider/test-model",
        temperature=0,
        reasoning={"effort": "none"},
        max_tokens=256,
    )


@pytest.mark.asyncio
async def test_get_intent_uses_user_requested_question_count():
    fake_result = QuizIntent(
        has_sufficient_info=True,
        qn_type="MCQ",
        difficulty="medium",
    )
    state = make_state("Create 8 medium Grade 3 reading comprehension MCQ questions")

    with patch_structured_llm(fake_result):
        result = await get_intent_node(state)

    assert result["question_count"] == 8


@pytest.mark.asyncio
async def test_get_intent_preserves_original_request_during_clarification():
    fake_result = QuizIntent(
        has_sufficient_info=True,
        qn_type="MCQ",
        topic="subject-verb agreement",
        difficulty="medium",
    )
    state = {
        "messages": [HumanMessage(content="Make it MCQ")],
        "clarification_query": (
            "Create 8 questions about subject-verb agreement\nMake it MCQ"
        ),
    }

    with patch_structured_llm(fake_result):
        result = await get_intent_node(state)

    assert result["query"] == (
        "Create 8 questions about subject-verb agreement\nMake it MCQ"
    )
    assert result["question_count"] == 8
    assert result["clarification_query"] is None


def test_quiz_intent_documents_band_difficulty_mapping():
    difficulty_schema = QuizIntent.model_json_schema()["properties"]["difficulty"]

    assert "Band A to easy" in difficulty_schema["description"]
    assert "Band B to medium" in difficulty_schema["description"]
    assert "Band C to hard" in difficulty_schema["description"]


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("Create a medium Grade 3 reading worksheet", 15),
        ("Create 8 medium Grade 3 reading comprehension questions", 8),
        ("Make me 6 phonics MCQs", 6),
        ("Give me 10 questions about grammar", 10),
        ("I would like 12 questions", 12),
        ("Questions: 4", 4),
    ],
)
def test_get_question_count(query, expected):
    assert get_question_count(query) == expected



@pytest.mark.asyncio
async def test_get_intent_node_returns_open_ended():
    fake_result = QuizIntent(has_sufficient_info=True, qn_type="Open_ended", difficulty="hard")
    state = make_state("Open ended grammar questions ")
 
    with patch_structured_llm(fake_result):
        result = await get_intent_node(state)
 
    assert result["qn_type"] == "Open_ended"
    assert result["difficulty"] == "hard"


@pytest.mark.asyncio
async def test_get_intent_node_handles_empty_info():
    fake_result = QuizIntent(
        has_sufficient_info=False,
        qn_type=None,
        difficulty=None,
        reason="No topic or question format specified.",
    )
    state = make_state("quiz me")
 
    with patch_structured_llm(fake_result):
        result = await get_intent_node(state)
 
    assert result["qn_type"] is None
    assert result["difficulty"] is None
    assert result["clarification_reason"] == "No topic or question format specified."


def test_route_does_not_require_difficulty():
    state = {"qn_type": "MCQ", "topic": "grammar", "difficulty": None}

    assert route_decision(state) == "ready"


def test_route_requires_a_topic():
    state = {"qn_type": "MCQ", "topic": None, "difficulty": "easy"}

    assert route_decision(state) == "needs_clarification"


@pytest.mark.asyncio
async def test_clarification_does_not_ask_for_difficulty():
    result = await ask_clarification_node(
        {"qn_type": None, "difficulty": None, "topic": None}
    )

    prompt = result["messages"][0].content
    assert "MCQ or Open-ended" in prompt
    assert "topic(s)" in prompt
    assert "difficulty" not in prompt.lower()
    assert all("difficulty" not in field.lower() for field in result["pending_fields"])

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query", ["asdkjhaskjdh gibberish input", "help me", ""]
)
async def test_get_intent_failure_nonsense_info_routes_to_clarification(query):
    state = make_state(query)
 
    mocked_ai_response = QuizIntent(
        has_sufficient_info=False,
        qn_type=None,
        difficulty=None,
        reason="Missing topic and question format.",
    )
 
    with patch_structured_llm(mocked_ai_response):
        result = await get_intent_node(state)
 
    assert result["qn_type"] is None
    assert result["difficulty"] is None
    assert result["clarification_reason"]  
    assert route_decision(result) == "needs_clarification"

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query", ["generate me a worksheet", "help me", ""]
)
async def test_get_intent_failure_insufficient_info_routes_to_clarification(query):
    state = make_state(query)
 
    mocked_ai_response = QuizIntent(
        has_sufficient_info=False,
        qn_type=None,
        difficulty=None,
        reason="Missing topic and question format.",
    )
 
    with patch_structured_llm(mocked_ai_response):
        result = await get_intent_node(state)
 
    assert result["qn_type"] is None
    assert result["difficulty"] is None
    assert result["clarification_reason"]  
    assert route_decision(result) == "needs_clarification"
