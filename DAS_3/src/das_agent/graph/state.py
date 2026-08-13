from typing import Any

from langchain_core.messages import AnyMessage
from typing_extensions import TypedDict, Annotated
from langgraph.graph.message import add_messages


class State(TypedDict, total=False):
    action: str
    qn_type: str | None
    question_count: int
    difficulty: str | None
    query: str
    topic: str | None
    clarification_reason: str | None
    clarification_query: str | None
    revision_instruction: str | None
    pending_fields: list[str]
    relevantDocs: list
    rankedDocs: list
    messages: Annotated[list[AnyMessage], add_messages]
    generated_worksheet: dict[str, Any]
