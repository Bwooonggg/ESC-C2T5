from pathlib import Path

import pytest
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage
from pymilvus import MilvusClient

from das_agent.nodes.nodes import RetrieveAndRerankNode
from das_agent.retrieval.knowledge_retriever import KnowledgeBaseRetriever


pytestmark = pytest.mark.integration
INTEGRATION_VECTOR = [0.1] * 384


class StaticEmbedding:
    def embed_query(self, query: str) -> list[float]:
        return INTEGRATION_VECTOR


class StaticReranker:
    def compute_score(
        self, query_and_chunk_pairs: list[tuple[str, str]]
    ) -> list[float]:
        return [float(index) for index in range(len(query_and_chunk_pairs))]


def create_integration_retriever(database_path: Path):
    return KnowledgeBaseRetriever(
        embedding_model=StaticEmbedding(),
        search_client=MilvusClient(uri=str(database_path)),
        reranker=StaticReranker(),
    )


def integration_record(index: int) -> dict:
    return {
        "id": index,
        "vector": INTEGRATION_VECTOR,
        "text": f"A subject is the focus of sentence {index}.",
        "source": {
            "dl_meta": {
                "origin": {"filename": "integration-fixture.pdf"},
                "headings": ["Grammar"],
                "doc_items": [{"prov": [{"page_no": index + 1}]}],
            }
        },
    }


@pytest.fixture
def integration_database_file(tmp_path: Path) -> Path:
    database_path = tmp_path / "integration-milvus.db"
    client = MilvusClient(uri=str(database_path))
    client.create_collection(
        collection_name="demo_collection",
        dimension=384,
        metric_type="COSINE",
    )
    client.insert(
        collection_name="demo_collection",
        data=[integration_record(index) for index in range(6)],
    )
    client.close()
    return database_path


def assert_document_fields(result: list[Document]):
    for document in result:
        assert isinstance(document, Document)
        assert isinstance(document.page_content, str)
        assert document.page_content
        assert isinstance(document.metadata["entity_id"], int)
        assert isinstance(document.metadata["filename"], str)
        assert isinstance(document.metadata["headings"], list)
        assert isinstance(document.metadata["page_numbers"], list)
        assert document.metadata["page_numbers"]
        assert all(
            isinstance(page_number, int) and page_number > 0
            for page_number in document.metadata["page_numbers"]
        )
        assert isinstance(document.metadata["reranker_score"], (int, float))


def test_subject_search(integration_database_file):
    client = MilvusClient(uri=str(integration_database_file))
    client.load_collection(collection_name="demo_collection")

    query = StaticEmbedding().embed_query("What is a subject?")
    result = client.search(
        collection_name="demo_collection",
        data=[query],
        limit=3,
        output_fields=["text", "source"],
    )

    assert result, "Search returned no results"
    assert len(result) == 1, "Expected one query result set"
    assert len(result[0]) == 3, "Expected three seeded results"
    client.close()


def test_rerank(integration_database_file):
    retriever = create_integration_retriever(integration_database_file)
    documents = retriever.retrieve("what is a subject?", 5)
    result = retriever.rerank("what is a subject?", documents, 10)

    assert len(documents) == 1
    assert len(documents[0]) == 5, "Expected 5 results"
    assert 1 < len(result) <= 10
    assert_document_fields(result)
    retriever._search_client.close()


@pytest.mark.asyncio
async def test_retrieve_and_rerank(integration_database_file):
    retriever = create_integration_retriever(integration_database_file)
    node = RetrieveAndRerankNode(retriever)

    result = await node(
        {
            "messages": [HumanMessage(content="what is a subject?")],
            "rankedDocs": [],
        }
    )
    ranked_documents = result["rankedDocs"]

    assert result["query"] == "what is a subject?"
    assert 1 <= len(ranked_documents) <= 5
    assert all(isinstance(document, Document) for document in ranked_documents)
    scores = [document.metadata["reranker_score"] for document in ranked_documents]
    assert all(isinstance(score, (int, float)) for score in scores)
    assert scores == sorted(scores, reverse=True)
    retriever._search_client.close()
