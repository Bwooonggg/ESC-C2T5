from langgraph.graph import StateGraph, START, END
from das_agent.retrieval.knowledge_retriever import KnowledgeBaseRetriever
from das_agent.nodes.nodes import (
    RetrieveAndRerankNode,
    WorksheetAgentNode,
    WorksheetRevisionNode,
    ask_clarification_node,
    get_intent_node,
    wait_for_clarification_node,
)
from das_agent.graph.state import State


def build_workflow(
    retriever: KnowledgeBaseRetriever,
    worksheet_llm,
    revision_llm=None,
    verifier_llm=None,
):
    workflow = StateGraph(State)

    workflow.add_node("retrieve_and_rerank", RetrieveAndRerankNode(retriever))
    workflow.add_node("get_intent", get_intent_node)
    workflow.add_node("worksheet_agent", WorksheetAgentNode(worksheet_llm))
    workflow.add_node(
        "worksheet_revision",
        WorksheetRevisionNode(
            revision_llm or worksheet_llm,
            verifier_llm=verifier_llm,
        ),
    )
    workflow.add_node("ask_clarification", ask_clarification_node)
    workflow.add_node("wait_for_clarification", wait_for_clarification_node)

    workflow.add_edge(START, "get_intent")
    workflow.add_conditional_edges(
        "get_intent",
        route_decision,
        {
            "create": "retrieve_and_rerank",
            "revise": "worksheet_revision",
            "needs_clarification": "ask_clarification",
        },
    )

    workflow.add_edge("ask_clarification", "wait_for_clarification")
    workflow.add_edge("wait_for_clarification", "get_intent")

    workflow.add_edge("retrieve_and_rerank", "worksheet_agent")
    workflow.add_edge("worksheet_agent", END)
    workflow.add_edge("worksheet_revision", END)

    return workflow


def agent_init(
    retriever: KnowledgeBaseRetriever,
    worksheet_llm,
    revision_llm=None,
    verifier_llm=None,
):
    return build_workflow(
        retriever,
        worksheet_llm,
        revision_llm=revision_llm,
        verifier_llm=verifier_llm,
    ).compile()


def route_decision(state: State) -> str:
    action = state.get("action")
    if action == "revise":
        if state.get("generated_worksheet"):
            return "revise"
        return "needs_clarification"

    valid_qn_type = state.get("qn_type") in ("MCQ", "Open_ended")
    valid_topic = bool(str(state.get("topic") or "").strip())
    if action == "create" and valid_qn_type and valid_topic:
        return "create"
    return "needs_clarification"
