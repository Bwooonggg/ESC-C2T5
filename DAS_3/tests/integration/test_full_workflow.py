import os

import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from langfuse.langchain import CallbackHandler
from pymilvus import MilvusClient
from FlagEmbedding import FlagReranker

from das_agent.graph.agent import build_workflow
from das_agent.nodes.nodes import ChatOpenRouter
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
    return {"configurable": {"thread_id": "live-test-thread"}}


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
def real_retriever(real_embedding, real_milvus_client, real_reranker):
    return KnowledgeBaseRetriever(
        embedding_model=real_embedding,
        search_client=real_milvus_client,
        reranker=real_reranker,
        collection_name=COLLECTION_NAME,
    )


@pytest.fixture
def workflow_app(real_retriever):
    real_llm = ChatOpenRouter(model=WORKSHEET_MODEL, temperature=0)

    return build_workflow(real_retriever, real_llm).compile(checkpointer=MemorySaver())


@pytest.mark.asyncio
async def test_clear_intent_flow_live(workflow_app, thread_config):
    config = {
        **thread_config,
        "callbacks": [langfuse_handler],
        "metadata": {"test_name": "test_clear_intent_flow_live"}
    }

    result = await workflow_app.ainvoke(
        {"messages": [HumanMessage(content="Create 4 easy MCQ questions on Fractions")]},
        config=config
    )

    assert "generated_worksheet" in result
    assert result["generated_worksheet"]["title"] is not None
    assert len(result["generated_worksheet"]["items"]) == 4


@pytest.mark.asyncio
async def test_open_ended_intent_flow_live(workflow_app, thread_config):
    config = {
        **thread_config,
        "metadata": {"test_name": "test_open_ended_intent_flow_live"},
        "callbacks": [langfuse_handler],
    }

    result = await workflow_app.ainvoke(
        {
            "messages": [
                HumanMessage(
                    content="Create 3 open-ended questions on Photosynthesis"
                )
            ]
        },
        config=config,
    )

    assert "generated_worksheet" in result
    assert result["generated_worksheet"]["title"] is not None
    items = result["generated_worksheet"]["items"]
    assert len(items) == 3
    for item in items:
        assert item["options"] == []
        assert item["answer"]


@pytest.mark.asyncio
async def test_clarified_intent_flow_live(workflow_app, thread_config):
    config = {
        **thread_config,
        "callbacks": [langfuse_handler],
        "metadata": {"test_name": "test_clarified_intent_flow_live"}
    }

    first = await workflow_app.ainvoke(
        {"messages": [HumanMessage(content="I want a worksheet please")]},
        config=config
    )

    assert "__interrupt__" in first
    assert "generated_worksheet" not in first

    second = await workflow_app.ainvoke(
        Command(resume="5 MCQ questions on Subject-Verb Agreement, medium difficulty please"),
        config=config
    )

    assert "generated_worksheet" in second
    assert second["generated_worksheet"]["title"] is not None
    assert len(second["generated_worksheet"]["items"]) == 5


@pytest.mark.asyncio
async def test_follow_up_revision_live(workflow_app, thread_config):
    config = {
        **thread_config,
        "callbacks": [langfuse_handler],
        "metadata": {"test_name": "test_follow_up_revision_live"}
    }

    first = await workflow_app.ainvoke(
        {
            "messages": [
                HumanMessage(
                    content="Generate a 5-question MCQ worksheet on subject-verb agreement"
                )
            ]
        },
        config=config,
    )

    assert "generated_worksheet" in first

    second = await workflow_app.ainvoke(
        {
            "messages": [
                HumanMessage(
                    content="Can you edit question 2 to make the options trickier?"
                )
            ]
        },
        config=config,
    )

    assert second["action"] == "revise"
    assert "generated_worksheet" in second
    assert second["messages"][-1].content is not None