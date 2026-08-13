from unittest.mock import AsyncMock, MagicMock, patch
 
import pytest
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command
from das_agent.graph.agent import agent_init, build_workflow
from das_agent.nodes import nodes
from das_agent.worksheet.schemas import GeneratedMCQWorksheet, MCQWorksheetItem


class FakeRetriever:
    def retrieve_and_rerank(self, query):
        return [
            Document(
                page_content=(
                    "Subject-verb agreement is a common challenge for learners "
                    "with dyslexia due to working memory difficulties."
                ),
                metadata={"source": "grammar_fundamentals.pdf"},
            )
        ]


def make_worksheet():
    options = ["dog", "run", "quickly", "blue"]
    return GeneratedMCQWorksheet(
        title="Grammar Practice",
        readingPassage="A dog runs through the park.",
        instructions="Choose the best answer.",
        items=[
            MCQWorksheetItem(
                question=f"Which word is a noun in sentence {index + 1}?",
                options=options[index % 4:] + options[:index % 4],
                answer="dog",
            )
            for index in range(15)
        ],
    )


def make_worksheet_llm():
    llm = MagicMock()
    structured_llm = MagicMock()
    structured_llm.ainvoke = AsyncMock(return_value=make_worksheet())
    llm.with_structured_output.return_value = structured_llm
    return llm


@pytest.mark.asyncio
async def test_e2e_sufficient_info_path_produces_worksheet():
    intent_response = MagicMock(
        qn_type="MCQ",
        topic="grammar",
        difficulty="medium",
        reason=None,
    )

    def make_llm(*args, **kwargs):
        llm = MagicMock()
        structured_llm = MagicMock()
        structured_llm.ainvoke = AsyncMock(return_value=intent_response)
        llm.with_structured_output.return_value = structured_llm

        return llm

    with patch.object(nodes, "ChatOpenRouter", side_effect=make_llm):
        graph = agent_init(FakeRetriever(), make_worksheet_llm())

        initial_state = {
            "messages": [
                HumanMessage(
                    content="Give me a medium MCQ quiz on grammar for a dyslexic learner"
                )
            ],
        }

        final_state = await graph.ainvoke(initial_state)

    assert final_state["qn_type"] == "MCQ"
    assert final_state["difficulty"] == "medium"
    assert final_state["rankedDocs"][0].metadata["source"] == "grammar_fundamentals.pdf"
    assert final_state["messages"][-1].content == (
        'I created "Grammar Practice" with 15 questions.'
    )
    assert not final_state.get("pending_fields")


@pytest.mark.asyncio
async def test_e2e_clarification_loop_then_succeeds():
    intent_responses = [
        MagicMock(qn_type=None, topic=None, difficulty=None, reason="Missing quiz type and topic."),
        MagicMock(qn_type="MCQ", topic="grammar", difficulty="medium", reason=None),
    ]
 
    def make_llm(*args, **kwargs):
        llm = MagicMock()
 
        structured_llm = MagicMock()
        structured_llm.ainvoke = AsyncMock(side_effect=lambda *a, **kw: intent_responses.pop(0))
        llm.with_structured_output.return_value = structured_llm
 
        return llm
 
    with patch.object(nodes, "ChatOpenRouter", side_effect=make_llm):
        checkpointer = InMemorySaver()
        workflow = build_workflow(FakeRetriever(), make_worksheet_llm())
        graph = workflow.compile(checkpointer=checkpointer)
 
        config = {"configurable": {"thread_id": "test-thread-clarification"}}
 
       
        initial_state = {"messages": [HumanMessage(content="quiz me")]}
 
        paused_state = await graph.ainvoke(initial_state, config=config)
 
       
        assert "__interrupt__" in paused_state
        interrupt_payload = paused_state["__interrupt__"][0].value
        assert "awaiting" in interrupt_payload
        assert paused_state["pending_fields"]  
 

        resume_value = {"qn_type": "MCQ", "difficulty": "medium", "topic": "grammar"}
        final_state = await graph.ainvoke(Command(resume=resume_value), config=config)

    assert final_state["qn_type"] == "MCQ"
    assert final_state["difficulty"] == "medium"
 
    assert final_state["messages"][-1].content == (
        'I created "Grammar Practice" with 15 questions.'
    )
 
    assert "__interrupt__" not in final_state or not final_state["__interrupt__"]
