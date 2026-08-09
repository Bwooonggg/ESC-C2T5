import asyncio
import os
import re
from langchain_core.messages import AIMessage
from langchain_openrouter import ChatOpenRouter
from pydantic import BaseModel, Field
from typing import Literal, Optional
from dotenv import load_dotenv
from langchain_core.messages import SystemMessage
from langchain_core.messages import HumanMessage
from langfuse._client.get_client import get_client
from langfuse import observe
from langfuse.langchain import CallbackHandler
from das_agent.worksheet.prompt import build_system_prompt
from das_agent.worksheet.schemas import GeneratedMCQWorksheet, GeneratedOpenEndedWorksheet
from das_agent.retrieval.knowledge_retriever import KnowledgeBaseRetriever
from das_agent.graph.state import State
from langgraph.types import interrupt

load_dotenv()
langfuse_handler = CallbackHandler()
langfuse = get_client()

class QuizIntent(BaseModel):
    has_sufficient_info: bool = Field(
        description=(
            "Whether the user's query gives enough information to confidently "
            "choose a quiz type. Set to False if the query is vague, off-topic, "
            "or missing key details such as the worksheet topic. Difficulty is "
            "optional and must not be a reason to request clarification."
        )
    )
    qn_type: Optional[Literal["MCQ", "Open_ended"]] = Field(
        description="Whether the quiz should be MCQ or open-ended"
    )
    topic: Optional[str] = Field(
        default=None,
        description=(
            "The concise worksheet topic explicitly requested by the user, "
            "for example Subject-Verb Agreement or Reading Comprehension"
        ),
    )
    difficulty: Optional[Literal["easy", "medium", "hard"]] = Field(
        description=(
            "Appropriate difficulty level given the content and learner needs. "
            "Map Band A to easy, Band B to medium, and Band C to hard."
        )
    )
    reason: Optional[str] = Field(
        default=None,
        description="If has_sufficient_info is False, a short explanation of what's missing or unclear."
    )

class RetrieveAndRerankNode:
    def __init__(self, retriever: KnowledgeBaseRetriever):
        self.retriever = retriever

    async def __call__(self, state: State):
        query = state.get("query") or get_query_text(state)
        ranked_docs = await asyncio.to_thread(
            self.retriever.retrieve_and_rerank,
            query,
        )

        return {"query": query, "rankedDocs": ranked_docs}

def get_query_text(state: State) -> str:
    for msg in reversed(state.get("messages") or []):
        if getattr(msg, "type", None) == "human" or isinstance(msg, HumanMessage):
            return str(msg.text)
    return ""


def get_question_count(query: str) -> int:
    patterns = (
        r"\b(?:create|generate|make|prepare|build|want|need)(?:\s+me)?\s+(\d+)\b",
        r"\bgive\s+me\s+(\d+)\b",
        r"\b(\d+)\s+(?:questions?|mcqs?|items?)\b",
        r"\b(?:questions?|mcqs?|items?)\s*(?:[:=]|to|is)?\s*(\d+)\b",
    )

    for pattern in patterns:
        match = re.search(pattern, query, flags=re.IGNORECASE)
        if match:
            count = int(match.group(1))
            if count > 0:
                return count

    return 15


def normalize_for_comparison(text: str) -> str:
    normalized_characters = []
    for character in text.casefold():
        if character.isalnum():
            normalized_characters.append(character)
    return "".join(normalized_characters)


@observe()
async def get_intent_node(state: State):
    model_name = os.getenv("OPENROUTER_MODEL", "qwen/qwen3.5-9b")
    llm = ChatOpenRouter(
        model=model_name,
        temperature=0,
        reasoning={"effort": "none"},
        max_tokens=256
    )

    query = state.get("clarification_query") or get_query_text(state)

    system_prompt = (
        "You are an educational therapist specialising in Dyslexia and Literacy Teaching. "
        "Based on the learner's query, decide whether a multiple-choice (MCQ) or open-ended "
        "quiz is more appropriate and extract the requested worksheet topic. "
        "Map Band A to easy, Band B to medium (slightly harder), "
        "and Band C to hard. Use medium when neither a band nor a difficulty preference is "
        "given.\n\n"
        "Never require the user to provide a difficulty level. If the query is too vague or "
        "missing key details such as a topic or usable question format, set "
        "has_sufficient_info to false, leave missing fields null, and briefly "
        "explain what's missing in reason."
    )
    messages = [SystemMessage(content=system_prompt)]
    conversation_history = state.get("messages") or []
    for message in conversation_history:
        if isinstance(message, HumanMessage) or isinstance(message, AIMessage):
            messages.append(message)

    structured_llm = llm.with_structured_output(QuizIntent, method="json_schema", strict=True)
    result = await structured_llm.ainvoke(messages)

    return {
        "qn_type": result.qn_type,
        "topic": result.topic,
        "question_count": get_question_count(query),
        "difficulty": result.difficulty,
        "query": query,
        "clarification_reason": result.reason,
        "clarification_query": None,
    }


class WorksheetAgentNode:
    def __init__(self, llm):
        self.structured_llms = {
            "MCQ": llm.with_structured_output(
                GeneratedMCQWorksheet,
                method="json_schema",
                strict=True,
            ),
            "Open_ended": llm.with_structured_output(
                GeneratedOpenEndedWorksheet,
                method="json_schema",
                strict=True,
            ),
        }

    @observe(name="worksheet_generation", as_type="chain")
    async def __call__(self, state: State):
        system_prompt = build_system_prompt(state)
        qn_type = state.get("qn_type")
        structured_llm = self.structured_llms[qn_type]
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(
                content=state.get("query", "Generate the worksheet.")
            ),
        ]

        try:
            worksheet = await structured_llm.ainvoke(
                messages,
                config={"callbacks": [langfuse_handler]},
            )
            self._validate_worksheet(worksheet, state)
        except ValueError:
            expected_count = state.get("question_count", 15)
            format_requirement = (
                "Every question must have exactly four distinct options, and "
                "its answer must exactly match one option. Write every MCQ as "
                "a complete question ending in ? or as a meaningful sentence "
                "with a ____ blank; never use an answer choice by itself as "
                "the question. Shuffle the options for each question and vary "
                "the correct-answer position across the worksheet."
                if qn_type == "MCQ"
                else "Every question must have an empty options list."
            )
            retry_messages = [
                *messages,
                HumanMessage(
                    content=(
                        "The previous worksheet did not satisfy the required schema. "
                        "Regenerate the complete worksheet with exactly "
                        f"{expected_count} questions. {format_requirement} "
                    )
                ),
            ]
            worksheet = await structured_llm.ainvoke(
                retry_messages,
                config={"callbacks": [langfuse_handler]},
            )
            self._validate_worksheet(worksheet, state)

        return {
            "generated_worksheet": worksheet.model_dump(),
            "messages": [
                AIMessage(
                    content=(
                        f'I created "{worksheet.title}" with '
                        f"{len(worksheet.items)} questions."
                    )
                )
            ],
        }

    @staticmethod
    def _validate_worksheet(worksheet, state: State):
        expected_count = state.get("question_count", 15)
        if len(worksheet.items) != expected_count:
            raise ValueError(
                f"Worksheet must contain exactly {expected_count} questions"
            )

        if state.get("qn_type") == "MCQ":
            correct_answer_positions = []
            for item in worksheet.items:
                if len(item.options) != 4 or len(set(item.options)) != 4:
                    raise ValueError(
                        "Every MCQ must contain exactly four distinct options"
                    )
                if item.answer not in item.options:
                    raise ValueError(
                        "Every MCQ answer must exactly match one option"
                    )
                correct_answer_positions.append(item.options.index(item.answer))

                question = item.question.strip()
                has_question_form = question.endswith("?")
                has_blank = "__" in question
                if not has_question_form and not has_blank:
                    raise ValueError(
                        "Every MCQ must be a complete question or contain a blank"
                    )

                normalized_question = normalize_for_comparison(question)
                normalized_answer = normalize_for_comparison(item.answer)
                if normalized_question == normalized_answer:
                    raise ValueError("An MCQ question cannot be only its answer")

            if (
                len(correct_answer_positions) > 1
                and len(set(correct_answer_positions)) == 1
            ):
                raise ValueError(
                    "Correct MCQ answers must not all use the same option position"
                )

async def ask_clarification_node(state: State):
    missing = []
    if state.get("qn_type") not in ("MCQ", "Open_ended"):
        missing.append("Would you like an MCQ or Open-ended worksheet?")
    if not state.get("topic"):
        missing.append("What topic(s) should the worksheet focus on?")

    reason = state.get("clarification_reason")
    intro = reason or "I need a bit more info to generate the right worksheet:"
    prompt_msg = intro
    for question in missing:
        prompt_msg = prompt_msg + "\n- " + question

    # This actually persists — appears as a normal assistant turn in ANY client
    return {"messages": [AIMessage(content=prompt_msg)], "pending_fields": missing}


async def wait_for_clarification_node(state: State):
    user_reply = interrupt({"awaiting": state.get("pending_fields")})

    if isinstance(user_reply, str):
        display_text = user_reply.strip()
    elif isinstance(user_reply, dict):
        reply_parts = []
        for key, value in user_reply.items():
            reply_parts.append(f"{key}: {value}")
        display_text = ", ".join(reply_parts)
    else:
        display_text = str(user_reply)

    previous_query = str(state.get("query") or "").strip()
    query_parts = []

    if previous_query:
        query_parts.append(previous_query)

    if display_text:
        query_parts.append(display_text)

    clarification_query = "\n".join(query_parts)

    return {
        "messages": [HumanMessage(content=display_text)],
        "pending_fields": [],
        "clarification_reason": None,
        "clarification_query": clarification_query,
    }
