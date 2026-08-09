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


def create_production_worksheet_llm():
    return ChatOpenRouter(
        model=os.getenv("OPENROUTER_MODEL", "qwen/qwen3.5-9b"),
        temperature=0,
        reasoning={"effort": "none"},
        max_tokens=4000,
    )


graph_dev_instance = agent_init(
    create_production_retriever(),
    create_production_worksheet_llm(),
)
