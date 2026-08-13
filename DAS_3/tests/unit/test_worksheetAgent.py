import pytest
from langchain_core.documents import Document

from das_agent.nodes.nodes import (
    WorksheetAgentNode,
    WorksheetRevisionNode,
    WorksheetRevisionVerification,
)
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
async def test_agent_result():
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
async def test_mcq_prompt():
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
async def test_open_prompt():
    fake_llm = FakeWorksheetLLM(make_worksheet())
    node = WorksheetAgentNode(fake_llm)

    await node(make_fake_state(qn_type="Open_ended"))

    system_message = fake_llm.messages[0]
    assert "Generate exactly 15 open-ended questions." in system_message.content
    assert "Generate exactly 15 multiple-choice questions." not in system_message.content


@pytest.mark.asyncio
async def test_question_count():
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
async def test_revision():
    original = make_worksheet(["dog", "runs", "quickly", "garden"])
    revised = original.model_copy(deep=True)
    revised.items[1].options[1] = "satting"
    state = make_fake_state()
    state.update(
        {
            "action": "revise",
            "query": "Edit question 2 so it has an option named satting",
            "generated_worksheet": original.model_dump(),
            "revision_instruction": (
                "Add the exact option 'satting' to question 2."
            ),
        }
    )
    verification = WorksheetRevisionVerification(
        instruction_satisfied=True,
        unrelated_content_preserved=True,
        feedback="The requested option was added to question 2.",
    )
    fake_llm = FakeWorksheetLLM([revised, verification])
    node = WorksheetRevisionNode(fake_llm)

    result = await node(state)

    prompt = fake_llm.message_batches[0][0].content
    assert "### REVISION INSTRUCTION" in prompt
    assert "### EXISTING WORKSHEET" in prompt
    assert original.items[0].question in prompt
    assert result["generated_worksheet"]["items"][1]["options"][1] == "satting"
    verification_messages = fake_llm.message_batches[1]
    assert verification_messages[0].type == "system"
    assert verification_messages[1].type == "human"
    verification_prompt = verification_messages[1].content
    assert "### ORIGINAL WORKSHEET" in verification_prompt
    assert "### PROPOSED WORKSHEET" in verification_prompt
    assert result["messages"][0].content == (
        'I updated "Grammar Practice" with 15 questions.'
    )


@pytest.mark.asyncio
async def test_retry_unchanged():
    original = make_worksheet(["dog", "runs", "quickly", "garden"])
    revised = original.model_copy(deep=True)
    revised.items[1].options[1] = "satting"
    state = make_fake_state()
    state.update(
        {
            "action": "revise",
            "generated_worksheet": original.model_dump(),
            "revision_instruction": (
                "Add the exact option 'satting' to question 2."
            ),
        }
    )
    verification = WorksheetRevisionVerification(
        instruction_satisfied=True,
        unrelated_content_preserved=True,
        feedback="The requested option was added to question 2.",
    )
    fake_llm = FakeWorksheetLLM([original, revised, verification])

    result = await WorksheetRevisionNode(fake_llm)(state)

    assert len(fake_llm.message_batches) == 3
    assert "identical to the original" in (
        fake_llm.message_batches[1][-1].content
    )
    assert "satting" in result["generated_worksheet"]["items"][1]["options"]
    assert result["messages"][0].content.startswith("I updated")


@pytest.mark.asyncio
async def test_unchanged_failure():
    original = make_worksheet(["dog", "runs", "quickly", "garden"])
    state = make_fake_state()
    state.update(
        {
            "action": "revise",
            "generated_worksheet": original.model_dump(),
            "revision_instruction": "Change question 2.",
        }
    )
    fake_llm = FakeWorksheetLLM([original, original, original])

    result = await WorksheetRevisionNode(fake_llm)(state)

    assert len(fake_llm.message_batches) == 3
    assert result["generated_worksheet"] == original.model_dump()
    assert result["messages"][0].content.startswith("Error:")
    assert "two retries" in result["messages"][0].content
    assert "updated" not in result["messages"][0].content.lower()


@pytest.mark.asyncio
async def test_retry_rejected_option():
    original = make_worksheet(["dog", "be", "quickly", "garden"])
    wrong_revision = original.model_copy(deep=True)
    wrong_revision.items[1].options[0] = "was"
    correct_revision = original.model_copy(deep=True)
    option_index = correct_revision.items[1].options.index("be")
    correct_revision.items[1].options[option_index] = "was"
    rejected = WorksheetRevisionVerification(
        instruction_satisfied=False,
        unrelated_content_preserved=False,
        feedback="Question 2 changed the wrong option; replace 'be' with 'was'.",
    )
    accepted = WorksheetRevisionVerification(
        instruction_satisfied=True,
        unrelated_content_preserved=True,
        feedback="Question 2 replaces 'be' with 'was' and preserves other content.",
    )
    state = make_fake_state()
    state.update(
        {
            "action": "revise",
            "generated_worksheet": original.model_dump(),
            "revision_instruction": "In question 2, replace option 'be' with 'was'.",
        }
    )
    fake_llm = FakeWorksheetLLM(
        [wrong_revision, rejected, correct_revision, accepted]
    )

    result = await WorksheetRevisionNode(fake_llm)(state)

    assert len(fake_llm.message_batches) == 4
    assert "changed the wrong option" in fake_llm.message_batches[2][-1].content
    revised_options = result["generated_worksheet"]["items"][1]["options"]
    assert "be" not in revised_options
    assert "was" in revised_options
    assert result["messages"][0].content.startswith("I updated")


@pytest.mark.asyncio
async def test_independent_verifier():
    original = make_worksheet(["dog", "be", "quickly", "garden"])
    revised = original.model_copy(deep=True)
    option_index = revised.items[1].options.index("be")
    revised.items[1].options[option_index] = "was"
    accepted = WorksheetRevisionVerification(
        instruction_satisfied=True,
        unrelated_content_preserved=True,
        feedback="The requested replacement is correct.",
    )
    revision_llm = FakeWorksheetLLM(revised)
    verifier_llm = FakeWorksheetLLM(accepted)
    state = make_fake_state()
    state.update(
        {
            "action": "revise",
            "generated_worksheet": original.model_dump(),
            "revision_instruction": "In question 2, replace option be with was.",
        }
    )

    result = await WorksheetRevisionNode(
        revision_llm,
        verifier_llm=verifier_llm,
    )(state)

    assert len(revision_llm.message_batches) == 1
    assert len(verifier_llm.message_batches) == 1
    assert verifier_llm.messages[0].type == "system"
    assert verifier_llm.messages[1].type == "human"
    assert "### PROPOSED WORKSHEET" in verifier_llm.messages[1].content
    assert "was" in result["generated_worksheet"]["items"][1]["options"]


@pytest.mark.asyncio
async def test_verifier_failure():
    original = make_worksheet(["dog", "runs", "quickly", "garden"])
    revised = original.model_copy(deep=True)
    revised.items[1].options[0] = "ranning"
    state = make_fake_state()
    state.update(
        {
            "action": "revise",
            "generated_worksheet": original.model_dump(),
            "revision_instruction": "In question 2, replace runs with ranning.",
        }
    )
    revision_llm = FakeWorksheetLLM([revised, revised, revised])
    verifier_llm = FakeWorksheetLLM(
        [
            RuntimeError("OpenRouter rejected the request"),
            RuntimeError("OpenRouter rejected the request"),
            RuntimeError("OpenRouter rejected the request"),
        ]
    )

    result = await WorksheetRevisionNode(
        revision_llm,
        verifier_llm=verifier_llm,
    )(state)

    assert len(revision_llm.message_batches) == 3
    assert len(verifier_llm.message_batches) == 3
    assert result["generated_worksheet"] == original.model_dump()
    assert result["messages"][0].content.startswith("Error:")


@pytest.mark.asyncio
async def test_reject_count():
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
async def test_reject_option_count():
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
async def test_retry_invalid_mcq():
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


def test_schema_option_counts():
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
async def test_retry_answer_question():
    invalid_worksheet = make_worksheet(["dog", "runs", "quickly", "garden"])
    invalid_worksheet.items[0].question = "dog"
    valid_worksheet = make_worksheet(["dog", "runs", "quickly", "garden"])
    fake_llm = FakeWorksheetLLM([invalid_worksheet, valid_worksheet])
    node = WorksheetAgentNode(fake_llm)

    result = await node(make_fake_state(qn_type="MCQ"))

    assert len(fake_llm.message_batches) == 2
    assert result["generated_worksheet"]["items"][0]["question"].endswith("?")


@pytest.mark.asyncio
async def test_retry_answer_position():
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
