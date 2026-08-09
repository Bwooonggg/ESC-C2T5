import pytest
from langchain_core.documents import Document

from das_agent.nodes.nodes import WorksheetAgentNode
from das_agent.worksheet.schemas import (
    GeneratedMCQWorksheet,
    GeneratedOpenEndedWorksheet,
    GeneratedWorksheet,
    WorksheetItem,
)


class FakeWorksheetLLM:
    def __init__(self, worksheet):
        self.worksheets = worksheet if isinstance(worksheet, list) else [worksheet]
        self.schemas = []
        self.message_batches = []
        self.configs = []
        self.messages = None

    def with_structured_output(self, schema, **kwargs):
        self.schemas.append(schema)
        assert kwargs == {"method": "json_schema", "strict": True}
        return self

    async def ainvoke(self, messages, config=None):
        self.messages = messages
        self.message_batches.append(messages)
        self.configs.append(config)
        index = min(len(self.message_batches) - 1, len(self.worksheets) - 1)
        result = self.worksheets[index]
        if isinstance(result, Exception):
            raise result
        return result


def make_fake_state(
    qn_type="MCQ",
    difficulty="medium",
    question_count=None,
) -> dict:
    state = {
        "qn_type": qn_type,
        "topic": "Subject-Verb Agreement",
        "difficulty": difficulty,
        "query": "quiz me on grammar",
        "rankedDocs": [
            Document(
                page_content=(
                    "Multisensory teaching approaches support learners with "
                    "dyslexia. Subject-verb agreement can be challenging."
                ),
                metadata={"source": "grammar_fundamentals.pdf"},
            )
        ],
    }
    if question_count is not None:
        state["question_count"] = question_count
    return state


def make_worksheet(options=None, count=15) -> GeneratedWorksheet:
    base_options = [] if options is None else options
    return GeneratedWorksheet(
        title="Grammar Practice",
        readingPassage="A dog runs quickly through the garden.",
        instructions="Read the passage and answer each question.",
        items=[
            WorksheetItem(
                question=f"{index + 1}. Which word names an animal?",
                options=(
                    []
                    if not base_options
                    else base_options[index % len(base_options):]
                    + base_options[:index % len(base_options)]
                ),
                answer="dog",
            )
            for index in range(count)
        ],
    )


@pytest.mark.asyncio
async def test_worksheet_agent_returns_structured_worksheet_and_message():
    worksheet = make_worksheet(["dog", "runs", "quickly", "garden"])
    fake_llm = FakeWorksheetLLM(worksheet)
    node = WorksheetAgentNode(fake_llm)

    result = await node(make_fake_state())

    assert result["generated_worksheet"] == worksheet.model_dump()
    assert result["generated_worksheet"]["title"]
    assert result["generated_worksheet"]["readingPassage"]
    assert len(result["generated_worksheet"]["items"]) == 15
    assert result["messages"][0].content == (
        'I created "Grammar Practice" with 15 questions.'
    )
    assert fake_llm.schemas == [
        GeneratedMCQWorksheet,
        GeneratedOpenEndedWorksheet,
    ]
    assert len(fake_llm.configs[0]["callbacks"]) == 1


@pytest.mark.asyncio
async def test_worksheet_agent_injects_context_and_mcq_template():
    fake_llm = FakeWorksheetLLM(
        make_worksheet(["dog", "runs", "quickly", "garden"])
    )
    node = WorksheetAgentNode(fake_llm)

    await node(make_fake_state(qn_type="MCQ", difficulty="hard"))

    system_message = fake_llm.messages[0]
    assert "Subject-verb agreement" in system_message.content
    assert "Multisensory teaching approaches" in system_message.content
    assert "hard" in system_message.content
    assert "Generate exactly 15 multiple-choice questions." in system_message.content
    assert "Focus on Subject-Verb Agreement" in system_message.content
    assert "Generate exactly 15 open-ended questions." not in system_message.content


@pytest.mark.asyncio
async def test_worksheet_agent_uses_open_ended_template():
    fake_llm = FakeWorksheetLLM(make_worksheet())
    node = WorksheetAgentNode(fake_llm)

    await node(make_fake_state(qn_type="Open_ended"))

    system_message = fake_llm.messages[0]
    assert "Generate exactly 15 open-ended questions." in system_message.content
    assert "Generate exactly 15 multiple-choice questions." not in system_message.content


@pytest.mark.asyncio
async def test_worksheet_agent_uses_user_requested_question_count():
    fake_llm = FakeWorksheetLLM(
        make_worksheet(["dog", "runs", "quickly", "garden"], count=8)
    )
    node = WorksheetAgentNode(fake_llm)

    result = await node(make_fake_state(question_count=8))

    assert len(result["generated_worksheet"]["items"]) == 8
    assert "Generate exactly 8 multiple-choice questions." in (
        fake_llm.messages[0].content
    )


@pytest.mark.asyncio
async def test_worksheet_agent_rejects_wrong_question_count():
    fake_llm = FakeWorksheetLLM(
        make_worksheet(["dog", "runs", "quickly", "garden"], count=14)
    )
    node = WorksheetAgentNode(fake_llm)

    with pytest.raises(
        ValueError,
        match="Worksheet must contain exactly 15 questions",
    ):
        await node(make_fake_state())


@pytest.mark.asyncio
async def test_worksheet_agent_rejects_mcq_without_four_options():
    fake_llm = FakeWorksheetLLM(
        make_worksheet(["dog", "runs", "garden"])
    )
    node = WorksheetAgentNode(fake_llm)

    with pytest.raises(
        ValueError,
        match="Every MCQ must contain exactly four distinct options",
    ):
        await node(make_fake_state(qn_type="MCQ"))

    assert len(fake_llm.message_batches) == 2
    assert all(len(config["callbacks"]) == 1 for config in fake_llm.configs)


@pytest.mark.asyncio
async def test_worksheet_agent_retries_invalid_mcq_once():
    invalid_worksheet = make_worksheet(["dog", "runs", "garden"])
    valid_worksheet = make_worksheet(["dog", "runs", "quickly", "garden"])
    fake_llm = FakeWorksheetLLM([invalid_worksheet, valid_worksheet])
    node = WorksheetAgentNode(fake_llm)

    result = await node(make_fake_state(qn_type="MCQ"))

    assert len(fake_llm.message_batches) == 2
    assert "previous worksheet did not satisfy" in (
        fake_llm.message_batches[1][-1].content.lower()
    )
    assert all(
        len(item["options"]) == 4
        for item in result["generated_worksheet"]["items"]
    )


def test_question_type_schemas_constrain_option_counts():
    ##$defs for json returns root element for json schema returned
    mcq_options_schema = (
        GeneratedMCQWorksheet.model_json_schema()["$defs"]
        ["MCQWorksheetItem"]["properties"]["options"]
    )
    open_ended_options_schema = (
        GeneratedOpenEndedWorksheet.model_json_schema()["$defs"]
        ["OpenEndedWorksheetItem"]["properties"]["options"]
    )

    assert mcq_options_schema["minItems"] == 4
    assert mcq_options_schema["maxItems"] == 4
    assert open_ended_options_schema["maxItems"] == 0


@pytest.mark.asyncio
async def test_worksheet_agent_retries_answer_like_question():
    invalid_worksheet = make_worksheet(["dog", "runs", "quickly", "garden"])
    invalid_worksheet.items[0].question = "dog"
    valid_worksheet = make_worksheet(["dog", "runs", "quickly", "garden"])
    fake_llm = FakeWorksheetLLM([invalid_worksheet, valid_worksheet])
    node = WorksheetAgentNode(fake_llm)

    result = await node(make_fake_state(qn_type="MCQ"))

    assert len(fake_llm.message_batches) == 2
    assert result["generated_worksheet"]["items"][0]["question"].endswith("?")


@pytest.mark.asyncio
async def test_worksheet_agent_retries_repeated_correct_answer_position():
    invalid_worksheet = make_worksheet(["dog", "runs", "quickly", "garden"])
    for item in invalid_worksheet.items:
        item.options = ["runs", "quickly", "dog", "garden"]

    valid_worksheet = make_worksheet(["dog", "runs", "quickly", "garden"])
    fake_llm = FakeWorksheetLLM([invalid_worksheet, valid_worksheet])
    node = WorksheetAgentNode(fake_llm)

    result = await node(make_fake_state(qn_type="MCQ"))

    answer_positions = [
        item["options"].index(item["answer"])
        for item in result["generated_worksheet"]["items"]
    ]
    assert len(fake_llm.message_batches) == 2
    assert len(set(answer_positions)) > 1
