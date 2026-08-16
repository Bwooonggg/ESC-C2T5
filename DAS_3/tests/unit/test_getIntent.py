import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from das_agent.nodes.nodes import QuizIntent, ask_clarification_node, get_intent_node
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
async def test_intent_state():
    fake_result = QuizIntent(
        action="create",
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
async def test_configured_model(monkeypatch):
    fake_result = QuizIntent(
        action="create",
        has_sufficient_info=True,
        qn_type="MCQ",
        topic="grammar",
        difficulty="medium",
    )
    monkeypatch.setenv("OPENROUTER_INTENT_MODEL", "provider/test-intent-model")

    with patch_structured_llm(fake_result) as openrouter:
        await get_intent_node(make_state("quiz me on grammar"))

    openrouter.assert_called_once_with(
        model="provider/test-intent-model",
        temperature=0,
        reasoning={"effort": "none"},
        max_tokens=512,
    )


@pytest.mark.asyncio
async def test_requested_count():
    fake_result = QuizIntent(
        action="create",
        has_sufficient_info=True,
        qn_type="MCQ",
        difficulty="medium",
        question_count=8,
    )
    state = make_state("Create 8 medium Grade 3 reading comprehension MCQ questions")

    with patch_structured_llm(fake_result):
        result = await get_intent_node(state)

    assert result["question_count"] == 8


@pytest.mark.asyncio
async def test_preserve_request():
    fake_result = QuizIntent(
        action="create",
        has_sufficient_info=True,
        qn_type="MCQ",
        topic="subject-verb agreement",
        difficulty="medium",
        question_count=8,
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


@pytest.mark.asyncio
async def test_edit_intent():
    state = {
        "messages": [
            HumanMessage(content="Create a Band A MCQ worksheet on subject verb agreement"),
            HumanMessage(
                content=(
                    "Can you edit question 2? I want it to have an option named satting"
                )
            ),
        ],
        "generated_worksheet": {
            "title": "Subject-Verb Agreement",
            "readingPassage": "A short passage.",
            "instructions": "Choose the best answer.",
            "items": [
                {
                    "question": f"Question {index + 1}?",
                    "options": ["sits", "sat", "sitting", "sit"],
                    "answer": "sits",
                }
                for index in range(15)
            ],
        },
        "qn_type": "MCQ",
        "topic": "Subject-Verb Agreement",
        "difficulty": "easy",
    }

    fake_result = QuizIntent(
        action="revise",
        has_sufficient_info=True,
        qn_type=None,
        topic=None,
        difficulty=None,
        revision_instruction="Add the exact option 'satting' to question 2.",
    )

    with patch_structured_llm(fake_result) as openrouter:
        result = await get_intent_node(state)

    openrouter.assert_called_once()
    assert result["action"] == "revise"
    assert result["question_count"] == 15
    assert result["qn_type"] == "MCQ"
    assert result["topic"] == "Subject-Verb Agreement"
    assert result["revision_instruction"] == (
        "Add the exact option 'satting' to question 2."
    )
    assert result["query"].startswith("Can you edit question 2")


@pytest.mark.asyncio
async def test_natural_revision():
    state = {
        "messages": [HumanMessage(content="Make number two easier")],
        "generated_worksheet": {
            "title": "Grammar Practice",
            "readingPassage": "A short passage.",
            "instructions": "Choose the best answer.",
            "items": [
                {
                    "question": f"Question {index + 1}?",
                    "options": ["one", "two", "three", "four"],
                    "answer": "one",
                }
                for index in range(4)
            ],
        },
        "qn_type": "MCQ",
        "topic": "Grammar",
        "difficulty": "medium",
    }
    fake_result = QuizIntent(
        action="revise",
        has_sufficient_info=True,
        qn_type=None,
        topic=None,
        difficulty=None,
        revision_instruction="Make question 2 easier.",
    )

    with patch_structured_llm(fake_result):
        result = await get_intent_node(state)

    assert result["action"] == "revise"
    assert result["revision_instruction"] == "Make question 2 easier."


@pytest.mark.asyncio
async def test_revision_without_sheet():
    fake_result = QuizIntent(
        action="revise",
        has_sufficient_info=True,
        qn_type=None,
        topic=None,
        difficulty=None,
        revision_instruction="Make question 2 easier.",
    )

    with patch_structured_llm(fake_result):
        result = await get_intent_node(
            make_state("Make number two easier")
        )

    assert result["action"] == "clarify"
    assert "no current worksheet" in result["clarification_reason"].lower()
    assert route_decision(result) == "needs_clarification"


def test_band_mapping_schema():
    difficulty_schema = QuizIntent.model_json_schema()["properties"]["difficulty"]

    assert "Band A to easy" in difficulty_schema["description"]
    assert "Band B to medium" in difficulty_schema["description"]
    assert "Band C to hard" in difficulty_schema["description"]


def test_revision_schema():
    properties = QuizIntent.model_json_schema()["properties"]

    assert "revision_instruction" in properties
    assert "revision_scope" not in properties
    assert "target_question_numbers" not in properties


@pytest.mark.asyncio
async def test_open_intent():
    fake_result = QuizIntent(
        action="create",
        has_sufficient_info=True,
        qn_type="Open_ended",
        difficulty="hard",
    )
    state = make_state("Open ended grammar questions ")
 
    with patch_structured_llm(fake_result):
        result = await get_intent_node(state)
 
    assert result["qn_type"] == "Open_ended"
    assert result["difficulty"] == "hard"


@pytest.mark.asyncio
async def test_empty_intent():
    fake_result = QuizIntent(
        action="clarify",
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


def test_optional_difficulty():
    state = {
        "action": "create",
        "qn_type": "MCQ",
        "topic": "grammar",
        "difficulty": None,
    }

    assert route_decision(state) == "create"


def test_required_topic():
    state = {
        "action": "create",
        "qn_type": "MCQ",
        "topic": None,
        "difficulty": "easy",
    }

    assert route_decision(state) == "needs_clarification"


def test_revision_route():
    state = {
        "action": "revise",
        "generated_worksheet": {"items": []},
    }

    assert route_decision(state) == "revise"


@pytest.mark.asyncio
async def test_no_difficulty_prompt():
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
async def test_nonsense_intent(query):
    state = make_state(query)
 
    mocked_ai_response = QuizIntent(
        action="clarify",
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
async def test_incomplete_intent(query):
    state = make_state(query)
 
    mocked_ai_response = QuizIntent(
        action="clarify",
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
