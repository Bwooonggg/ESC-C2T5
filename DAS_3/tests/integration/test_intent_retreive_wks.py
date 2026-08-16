import os

import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, END, StateGraph
from langfuse.langchain import CallbackHandler
from pymilvus import MilvusClient
from FlagEmbedding import FlagReranker

from das_agent.graph.state import State
from das_agent.nodes.nodes import (
    ChatOpenRouter,
    RetrieveAndRerankNode,
    WorksheetAgentNode,
    get_intent_node,
)
from das_agent.graph.agent import route_decision
from das_agent.retrieval.knowledge_retriever import KnowledgeBaseRetriever
from das_agent.retrieval.ingestion import (
    COLLECTION_NAME,
    get_embedding,
    get_milvus_db_path,
)

pytestmark = pytest.mark.integration
langfuse_handler = CallbackHandler()

WORKSHEET_MODEL = os.getenv("OPENROUTER_INTENT_MODEL", "qwen/qwen3.5-27b")
RERANKER_MODEL_ID = "BAAI/bge-reranker-base"


@pytest.fixture
def thread_config():
    return {"configurable": {"thread_id": "live-segmented-test-thread"}}


@pytest.fixture(scope="session")
def real_reranker():
    return FlagReranker(RERANKER_MODEL_ID, use_fp16=True)


@pytest.fixture(scope="session")
def real_embedding():
    return get_embedding()


@pytest.fixture
def real_milvus_client():
    return MilvusClient(uri=get_milvus_db_path())


@pytest.fixture
def real_components(real_embedding, real_milvus_client, real_reranker):
    real_llm = ChatOpenRouter(model=WORKSHEET_MODEL, temperature=0)

    real_retriever = KnowledgeBaseRetriever(
        embedding_model=real_embedding,
        search_client=real_milvus_client,
        reranker=real_reranker,
        collection_name=COLLECTION_NAME,
    )

    return real_retriever, real_llm


@pytest.mark.asyncio
async def test_live_intent_to_retrieval_flow(real_components, thread_config):
    real_retriever, real_llm = real_components

    workflow = StateGraph(State)
    workflow.add_node("get_intent", get_intent_node)
    workflow.add_node("retrieve_and_rerank", RetrieveAndRerankNode(real_retriever))

    workflow.add_edge(START, "get_intent")
    workflow.add_conditional_edges(
        "get_intent",
        route_decision,
        {
            "create": "retrieve_and_rerank",
            "needs_clarification": END,
            "revise": "retrieve_and_rerank",
        },
    )
    workflow.add_edge("retrieve_and_rerank", END)

    app = workflow.compile(checkpointer=MemorySaver())

    config = {
        **thread_config,
        "callbacks": [langfuse_handler],
        "metadata": {"test_name": "test_live_intent_to_retrieval_flow"}
    }

    initial_state = {
        "messages": [HumanMessage(content="Create a 2-question MCQ worksheet on Fractions")],
        "qn_type": None,
        "topic": None,
        "difficulty": None,
        "question_count": None,
        "rankedDocs": [],
    }

    result = await app.ainvoke(initial_state, config=config)

    assert result["action"] == "create"
    assert result["topic"].lower() == "fractions"
    assert "rankedDocs" in result
    assert len(result["rankedDocs"]) > 0


@pytest.mark.asyncio
async def test_live_retrieval_to_generation_flow(real_components, thread_config):
    real_retriever, real_llm = real_components

    workflow = StateGraph(State)
    workflow.add_node("retrieve_and_rerank", RetrieveAndRerankNode(real_retriever))
    workflow.add_node("worksheet_agent", WorksheetAgentNode(real_llm))

    workflow.add_edge(START, "retrieve_and_rerank")
    workflow.add_edge("retrieve_and_rerank", "worksheet_agent")
    workflow.add_edge("worksheet_agent", END)

    app = workflow.compile(checkpointer=MemorySaver())

    config = {
        **thread_config,
        "callbacks": [langfuse_handler],
        "metadata": {"test_name": "test_live_retrieval_to_generation_flow"}
    }

    initial_state = {
        "messages": [HumanMessage(content="Create a 2-question MCQ worksheet on Fractions")],
        "qn_type": "MCQ",
        "topic": "Fractions",
        "difficulty": "easy",
        "question_count": 2,
        "rankedDocs": [],
    }

    result = await app.ainvoke(initial_state, config=config)

    assert "rankedDocs" in result
    assert "generated_worksheet" in result
    assert result["generated_worksheet"]["title"] is not None
    assert len(result["generated_worksheet"]["items"]) == 2