import pytest
from langchain_core.documents import Document
from das_agent.worksheet.prompt import MULTIPLE_CHOICE_PROMPT, OPEN_ENDED_PROMPT, build_system_prompt

MOCK_STATE = {
    "difficulty": "Beginner",
    "topic": "CVC blending, sight words",
    "question_count": 8,
    "context_docs": "The cat sat on the mat. Phonics involves sound-letter relationships."
}


def test_mcq_fields():
    result = MULTIPLE_CHOICE_PROMPT.format(**MOCK_STATE)

    assert "{difficulty}" not in result
    assert "{topic}" not in result
    assert "{context_docs}" not in result


def test_open_fields():
    result = OPEN_ENDED_PROMPT.format(**MOCK_STATE)

    assert "{difficulty}" not in result
    assert "{topic}" not in result
    assert "{context_docs}" not in result


def test_mcq_values():
    result = MULTIPLE_CHOICE_PROMPT.format(**MOCK_STATE)

    assert "Band A as easy" in result
    assert "Band B as medium" in result
    assert "Band C as hard" in result
    assert "Beginner" in result
    assert "CVC blending, sight words" in result
    assert "exactly 8 multiple-choice questions" in result
    assert "Shuffle the four options independently" in result
    assert "never put every correct answer in the same position" in result
    assert "The cat sat on the mat." in result


def test_open_values():
    result = OPEN_ENDED_PROMPT.format(**MOCK_STATE)

    assert "Band A as easy" in result
    assert "Band B as medium" in result
    assert "Band C as hard" in result
    assert "Beginner" in result
    assert "CVC blending, sight words" in result


def test_missing_prompt_field():
    incomplete_state = {
        "topic": "CVC blending",
        "question_count": 15,
        "context_docs": "Some context."
    }

    with pytest.raises(KeyError, match="difficulty"):
        MULTIPLE_CHOICE_PROMPT.format(**incomplete_state)


def test_prompt_defaults():
    state = {
        "qn_type": "MCQ",
        "rankedDocs": [],
    }

    system_prompt = build_system_prompt(state)

    assert "General Literacy" in system_prompt
    assert "medium" in system_prompt
    assert "exactly 15 multiple-choice questions" in system_prompt


def test_prompt_formatting():
    state = {
        "qn_type": "MCQ",
        "topic": "CVC blending",
        "difficulty": "Beginner",
        "rankedDocs": [Document(page_content="The cat sat on the mat.")],
        "query": "Generate a quiz.",
    }

    system_prompt = build_system_prompt(state)

    assert "{difficulty}" not in system_prompt
    assert "{topic}" not in system_prompt
    assert "{context_docs}" not in system_prompt

    assert "Beginner" in system_prompt
    assert "CVC blending" in system_prompt
    assert "The cat sat on the mat." in system_prompt


def test_open_selection():
    state = {
        "qn_type": "OPEN_ENDED",
        "topic": "Phonics",
        "difficulty": "Intermediate",
        "rankedDocs": [Document(page_content="Some content.")],
    }

    system_prompt = build_system_prompt(state)

    assert "Generate exactly 15 open-ended questions." in system_prompt
    assert "Phonics" in system_prompt
    assert "Intermediate" in system_prompt


def test_joined_docs():
    state = {
        "qn_type": "MCQ",
        "rankedDocs": [
            Document(page_content="Doc one."),
            Document(page_content="Doc two."),
        ],
    }

    system_prompt = build_system_prompt(state)

    assert "Doc one." in system_prompt
    assert "Doc two." in system_prompt


@pytest.mark.parametrize("qn_type", ["MCQ", "Open_ended"])
def test_no_plain_text(qn_type):
    system_prompt = build_system_prompt(
        {
            "qn_type": qn_type,
            "rankedDocs": [],
        }
    )

    assert "OUTPUT FORMAT" not in system_prompt
    assert "QUESTIONS LEVEL" not in system_prompt
    assert "Return ONLY" not in system_prompt
