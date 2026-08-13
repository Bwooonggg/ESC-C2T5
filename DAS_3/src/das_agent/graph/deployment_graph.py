import os
from pathlib import Path

from FlagEmbedding import FlagReranker
from langchain_openrouter import ChatOpenRouter
from pymilvus import MilvusClient

from das_agent.graph.agent import agent_init
from das_agent.retrieval.ingestion import get_embedding, get_milvus_db_path
from das_agent.retrieval.knowledge_retriever import KnowledgeBaseRetriever


def create_production_retriever() -> KnowledgeBaseRetriever:
    database_file = Path(get_milvus_db_path())
    return KnowledgeBaseRetriever(
        embedding_model=get_embedding(),
        search_client=MilvusClient(uri=str(database_file)),
        reranker=FlagReranker("BAAI/bge-reranker-base", use_fp16=False),
    )


def create_openrouter_llm(
    model_environment_variable: str,
    default_model: str,
    *,
    max_tokens: int = 4000,
):
    return ChatOpenRouter(
        model=os.getenv(model_environment_variable, default_model),
        temperature=0,
        reasoning={"effort": "none"},
        max_tokens=max_tokens,
    )


graph_dev_instance = agent_init(
    create_production_retriever(),
    create_openrouter_llm("OPENROUTER_MODEL", "qwen/qwen3.5-9b"),
    revision_llm=create_openrouter_llm(
        "OPENROUTER_REVISION_MODEL",
        "qwen/qwen3.5-27b",
    ),
    verifier_llm=create_openrouter_llm(
        "OPENROUTER_VERIFIER_MODEL",
        "qwen/qwen3.5-27b",
        max_tokens=512,
    ),
)
