import asyncio
import json
import os
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
    action: Literal["create", "revise", "clarify"] = Field(
        description=(
            "The user's intent. Use create for a new worksheet, revise when the "
            "user wants to change the current worksheet, and clarify when the "
            "request cannot yet be acted on."
        )
    )
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
    question_count: Optional[int] = Field(
        default=None,
        ge=1,
        description=(
            "The number of questions explicitly requested for a new worksheet. "
            "Use null when no number was requested or when revising a worksheet."
        ),
    )
    revision_instruction: Optional[str] = Field(
        default=None,
        description=(
            "A concise, self-contained description of the requested revision, "
            "including exact wording supplied by the user."
        ),
    )
    reason: Optional[str] = Field(
        default=None,
        description="If has_sufficient_info is False, a short explanation of what's missing or unclear."
    )


class WorksheetRevisionVerification(BaseModel):
    instruction_satisfied: bool = Field(
        description=(
            "Whether the proposed worksheet applies the revision instruction "
            "to the exact requested question, option, or content."
        )
    )
    unrelated_content_preserved: bool = Field(
        description=(
            "Whether all worksheet content outside the requested edit is unchanged."
        )
    )
    feedback: str = Field(
        description=(
            "A concise explanation of any incorrect or missing edit, suitable for "
            "guiding another revision attempt."
        )
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


def normalize_for_comparison(text: str) -> str:
    normalized_characters = []
    for character in text.casefold():
        if character.isalnum():
            normalized_characters.append(character)
    return "".join(normalized_characters)


@observe()
async def get_intent_node(state: State):
    query = state.get("clarification_query") or get_query_text(state)
    current_worksheet = state.get("generated_worksheet") or {}
    current_items = current_worksheet.get("items") or []
    current_summary = {
        "exists": bool(current_worksheet),
        "title": current_worksheet.get("title"),
        "question_count": len(current_items),
        "question_type": state.get("qn_type"),
        "topic": state.get("topic"),
        "difficulty": state.get("difficulty"),
    }

    model_name = os.getenv(
        "OPENROUTER_INTENT_MODEL",
        "qwen/qwen3.5-27b",
    )
    llm = ChatOpenRouter(
        model=model_name,
        temperature=0,
        reasoning={"effort": "none"},
        max_tokens=512,
    )

    system_prompt = (
        "You are an educational therapist specialising in Dyslexia and Literacy Teaching. "
        "Classify the user's latest worksheet request as create, revise, or clarify. "
        "Use revise when the user wants to alter the current worksheet, including natural "
        "phrasing such as 'make number two easier', 'swap this option', or 'keep everything "
        "but rewrite the last question'. For revisions, produce one self-contained "
        "revision instruction that retains exact user-supplied wording, question "
        "references, and requested replacements. "
        "Use create when the user is asking for a new worksheet and extract its question "
        "type, topic, and explicit question count. Defaulting the count happens later. "
        "Map Band A to easy, Band B to medium (slightly harder), "
        "and Band C to hard. Use medium when neither a band nor a difficulty preference is "
        "given.\n\n"
        "Never require the user to provide a difficulty level. If the query is too vague or "
        "missing key details, use clarify, set has_sufficient_info to false, leave missing "
        "fields null, and briefly explain what's missing in reason. A revision is actionable "
        "only when a current worksheet exists.\n\n"
        "Current worksheet summary:\n"
        f"{json.dumps(current_summary, ensure_ascii=False)}"
    )
    messages = [SystemMessage(content=system_prompt)]
    conversation_history = state.get("messages") or []
    for message in conversation_history:
        if isinstance(message, HumanMessage) or isinstance(message, AIMessage):
            messages.append(message)

    structured_llm = llm.with_structured_output(QuizIntent, method="json_schema", strict=True)
    result = await structured_llm.ainvoke(messages)

    if result.action == "revise":
        if not current_worksheet:
            return {
                "action": "clarify",
                "qn_type": None,
                "topic": None,
                "question_count": 15,
                "difficulty": None,
                "query": query,
                "revision_instruction": None,
                "clarification_reason": (
                    "There is no current worksheet to revise. Please create a "
                    "worksheet first."
                ),
                "clarification_query": None,
            }

        previous_type = state.get("qn_type")
        if previous_type not in ("MCQ", "Open_ended"):
            previous_type = (
                "MCQ"
                if any(item.get("options") for item in current_items)
                else "Open_ended"
            )

        return {
            "action": "revise",
            "qn_type": previous_type,
            "topic": state.get("topic") or current_worksheet.get("title"),
            "question_count": len(current_items),
            "difficulty": state.get("difficulty") or "medium",
            "query": query,
            "revision_instruction": result.revision_instruction or query,
            "clarification_reason": None,
            "clarification_query": None,
        }

    action = (
        "clarify"
        if result.action == "clarify" or not result.has_sufficient_info
        else "create"
    )

    return {
        "action": action,
        "qn_type": result.qn_type,
        "topic": result.topic,
        "question_count": result.question_count or 15,
        "difficulty": result.difficulty,
        "query": query,
        "revision_instruction": None,
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
        return await self._invoke(
            state,
            system_prompt=build_system_prompt(state),
            success_action="created",
            retry_action="Regenerate the complete worksheet",
        )

    async def _invoke(
        self,
        state: State,
        *,
        system_prompt: str,
        success_action: str,
        retry_action: str,
    ):
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
            worksheet = self._prepare_worksheet(worksheet, state)
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
                        f"{retry_action} with exactly "
                        f"{expected_count} questions. {format_requirement} "
                    )
                ),
            ]
            worksheet = await structured_llm.ainvoke(
                retry_messages,
                config={"callbacks": [langfuse_handler]},
            )
            worksheet = self._prepare_worksheet(worksheet, state)
            self._validate_worksheet(worksheet, state)

        return {
            "generated_worksheet": worksheet.model_dump(),
            "messages": [
                AIMessage(
                    content=(
                        f'I {success_action} "{worksheet.title}" with '
                        f"{len(worksheet.items)} questions."
                    )
                )
            ],
        }

    @staticmethod
    def _prepare_worksheet(worksheet, state: State):
        return worksheet

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


class WorksheetRevisionNode(WorksheetAgentNode):
    def __init__(self, llm, verifier_llm=None):
        super().__init__(llm)
        self.revision_verifier = (verifier_llm or llm).with_structured_output(
            WorksheetRevisionVerification,
            method="json_schema",
            strict=True,
        )

    @observe(name="worksheet_revision", as_type="chain")
    async def __call__(self, state: State):
        original_worksheet = state.get("generated_worksheet") or {}
        current_worksheet = json.dumps(
            original_worksheet,
            ensure_ascii=False,
            indent=2,
        )
        revision_instruction = (
            state.get("revision_instruction") or state.get("query") or ""
        )
        qn_type = state.get("qn_type")
        type_requirement = (
            "Every question must have exactly four distinct options and an "
            "answer that exactly matches one option."
            if qn_type == "MCQ"
            else "Every question must have an empty options list and a model answer."
        )
        system_prompt = (
            "You are an expert educational therapist specialising in Dyslexia "
            "and Literacy Teaching. Revise the existing worksheet according to "
            "the user's revision instruction. Return the complete revised worksheet "
            "using the required response schema. Preserve all content outside the "
            "requested change. Include exact wording requested by the user, including "
            "replacement option text. Do not create an unrelated replacement. "
            f"Keep exactly {state.get('question_count', 15)} questions. "
            f"{type_requirement}\n\n"
            "### REVISION INSTRUCTION\n"
            f"{revision_instruction}\n\n"
            "### EXISTING WORKSHEET\n"
            f"{current_worksheet}"
        )
        structured_llm = self.structured_llms[qn_type]
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=revision_instruction),
        ]

        retry_feedback = None
        for _ in range(3):
            attempt_messages = messages
            if retry_feedback:
                attempt_messages = [
                    *messages,
                    HumanMessage(
                        content=(
                            "The previous revision was rejected. Apply the original "
                            "revision instruction again, correcting this problem: "
                            f"{retry_feedback}"
                        )
                    ),
                ]

            try:
                worksheet = await structured_llm.ainvoke(
                    attempt_messages,
                    config={"callbacks": [langfuse_handler]},
                )
                self._validate_worksheet(worksheet, state)
            except ValueError as error:
                retry_feedback = (
                    "The proposed worksheet was invalid: "
                    f"{error}. Return a valid complete worksheet while applying only "
                    "the requested edit."
                )
                continue
            proposed_worksheet = worksheet.model_dump()
            if proposed_worksheet == original_worksheet:
                retry_feedback = (
                    "The proposed worksheet was identical to the original. Make the "
                    "specific requested edit and leave everything else unchanged."
                )
                continue

            verification_system_prompt = (
                "Verify whether the proposed worksheet correctly applies the user's "
                "revision instruction to the original worksheet. The exact requested "
                "question, option, and replacement wording must be correct. Content "
                "outside the requested edit must remain unchanged. Do not approve a "
                "proposal merely because it differs from the original."
            )
            verification_payload = (
                "### REVISION INSTRUCTION\n"
                f"{revision_instruction}\n\n"
                "### ORIGINAL WORKSHEET\n"
                f"{current_worksheet}\n\n"
                "### PROPOSED WORKSHEET\n"
                f"{json.dumps(proposed_worksheet, ensure_ascii=False, indent=2)}"
            )
            try:
                verification = await self.revision_verifier.ainvoke(
                    [
                        SystemMessage(content=verification_system_prompt),
                        HumanMessage(content=verification_payload),
                    ],
                    config={"callbacks": [langfuse_handler]},
                )
            except Exception:
                retry_feedback = (
                    "The previous proposal could not be verified because the "
                    "verification service failed. Apply the exact instruction again "
                    "and preserve everything else."
                )
                continue
            if (
                verification.instruction_satisfied
                and verification.unrelated_content_preserved
            ):
                return {
                    "generated_worksheet": proposed_worksheet,
                    "messages": [
                        AIMessage(
                            content=(
                                f'I updated "{worksheet.title}" with '
                                f"{len(worksheet.items)} questions."
                            )
                        )
                    ],
                }

            retry_feedback = verification.feedback or (
                "The proposal did not apply the exact requested edit while preserving "
                "unrelated worksheet content."
            )

        return {
            "generated_worksheet": original_worksheet,
            "messages": [
                AIMessage(
                    content=(
                        "Error: I couldn't apply the requested worksheet edit after "
                        "two retries. The original worksheet has been kept unchanged."
                    )
                )
            ],
        }

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
