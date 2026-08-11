from pathlib import Path

import pytest
from langchain_core.messages import HumanMessage
from pymilvus import MilvusClient
from das_agent.retrieval.ingestion import get_milvus_db_path
from das_agent.retrieval.knowledge_retriever import KnowledgeBaseRetriever
from das_agent.nodes.nodes import RetrieveAndRerankNode
from langchain_core.documents import Document
from unittest.mock import Mock
INTEGRATION_VECTOR = [0.1] * 384

retriever = KnowledgeBaseRetriever(
        embedding_model=Mock(),
        search_client=Mock(),
        reranker=Mock(),
        )


def test_default_milvus_path_is_relative_to_project_root(monkeypatch):
    monkeypatch.delenv("MILVUS_DB_PATH", raising=False)

    expected_path = Path(__file__).resolve().parents[1] / "data" / "milvus" / "docling.db"

    assert Path(get_milvus_db_path()) == expected_path


@pytest.mark.asyncio
async def test_retrieval_uses_combined_clarification_query():
    search_retriever = Mock()
    search_retriever.retrieve_and_rerank.return_value = []
    node = RetrieveAndRerankNode(search_retriever)
    combined_query = (
        "Create a worksheet about subject-verb agreement\nMake it MCQ"
    )

    result = await node(
        {
            "query": combined_query,
            "messages": [HumanMessage(content="Make it MCQ")],
        }
    )

    search_retriever.retrieve_and_rerank.assert_called_once_with(combined_query)
    assert result["query"] == combined_query

def create_integration_retriever(database_path: Path):
    return KnowledgeBaseRetriever(
        embedding_model=StaticEmbedding(),
        search_client=MilvusClient(uri=str(database_path)),
        reranker=StaticReranker(),
    )


class StaticEmbedding:
    def embed_query(self, query: str) -> list[float]:
        return INTEGRATION_VECTOR


class StaticReranker:
    def compute_score(self, query_and_chunk_pairs: list[tuple[str, str]]) -> list[float]:
        return [float(index) for index in range(len(query_and_chunk_pairs))]


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


def make_search_result(index: int) -> dict:
    return {
        "entity": {
            "id": index,
            "text": f"Candidate document {index}",
            "source": {
                "dl_meta": {
                    "origin": {"filename": f"doc-{index}.pdf"},
                    "headings": [],
                    "doc_items": [
                        {"prov": [{"page_no": 1}]},
                    ],
                }
            },
        }
    }

@pytest.mark.integration
def test_subject_search(integration_database_file):
    client = MilvusClient(uri=str(integration_database_file))
    client.load_collection(collection_name="demo_collection")

    query = StaticEmbedding().embed_query("What is a subject?")

    res = client.search(
        collection_name="demo_collection",
        data=[query],
        limit=3,
        output_fields=["text", "source"],
    )

    assert res, "Search returned no results"
    assert len(res) == 1, "Expected one query result set"
    assert len(res[0]) == 3, "Expected three seeded results"
    client.close()

@pytest.mark.integration
def test_rerank(integration_database_file):
    integration_retriever = create_integration_retriever(integration_database_file)
    docs = integration_retriever.retrieve("what is a subject?", 5)
    result = integration_retriever.rerank("what is a subject?", docs, 10)
    assert len(docs) == 1
    assert len(docs[0]) == 5, "Expected 5 results"
    assert 1 < len(result) <= 10
    doc_fields(result)
    integration_retriever._search_client.close()


def doc_fields(result: list):
    for doc in result:
        assert isinstance(doc, Document)

        assert isinstance(doc.page_content, str)
        assert doc.page_content

        assert isinstance(doc.metadata["entity_id"], int)

        assert isinstance(doc.metadata["filename"], str)

        assert isinstance(doc.metadata["headings"], list)

        assert isinstance(doc.metadata["page_numbers"], list)
        assert doc.metadata["page_numbers"]
        assert all(
            isinstance(page_number, int) and page_number > 0
            for page_number in doc.metadata["page_numbers"]
        )

        assert isinstance(doc.metadata["reranker_score"], (int, float))


def test_retrieve_from_kb_unit_below_5():
    try:
        retriever.retrieve("test", 4)
        assert False, "Expected ValueError for top_k below 5"
    except ValueError as error:
        assert str(error) == "top_k must be >= 5 for reranking"

def test_retrieve_from_kb_at_5():
    fake_vector = [0.1, 0.2]
    fake_search_results = [[
        {"entity": {"text": "document one", "source": "a.pdf"}}
    ]]

    retriever._embedding_model.embed_query.return_value = fake_vector

    retriever._search_client.search.return_value = fake_search_results

    result = retriever.retrieve(
        query="test",
        top_k=5,
    )
    assert result == fake_search_results
    retriever._embedding_model.embed_query.assert_called_once_with("test")
    retriever._search_client.search.assert_called_once_with(
        collection_name="demo_collection",
        data=[fake_vector],
        limit=5,
        output_fields=["text", "source"],
    )
    retriever._embedding_model.embed_query.reset_mock()
    retriever._search_client.search.reset_mock()

def test_retrieve_from_kb_above_5():
    fake_vector = [0.2, 0.3]
    fake_search_results = [[
        {"entity": {"text": "document two", "source": "a.pdf"}}
    ]]

    retriever._embedding_model.embed_query.return_value = fake_vector

    retriever._search_client.search.return_value = fake_search_results

    result = retriever.retrieve(
        query="test",
        top_k=6,
    )

    assert result == fake_search_results

    retriever._embedding_model.embed_query.assert_called_once_with("test")
    retriever._search_client.search.assert_called_once_with(
        collection_name="demo_collection",
        data=[fake_vector],
        limit=6,
        output_fields=["text", "source"],
    )

def test_rerank_from_kb_unit():
    matches = [make_search_result(i) for i in range(10)]
    search_results = [matches]  #same structure as the milvus call

    # Return each candidate a predictable score where doc 9 should rank first.
    retriever._reranker.compute_score.return_value = [float(i) for i in range(10)]

    result = retriever.rerank(
        query="what is a subject?",
        search_results=search_results,
        top_k=20,
    )

    # There are only 10 available though the Python's [:20] safely returns all 10.
    assert len(result) == 10

    # Results should be sorted by reranker score, highest first (9).
    assert [doc.metadata["entity_id"] for doc in result] == [
        9, 8, 7, 6, 5, 4, 3, 2, 1, 0
    ]

    retriever._reranker.compute_score.assert_called_once()


def test_rerank_returns_empty_list_without_calling_the_reranker():
    retriever._reranker.compute_score.reset_mock()

    result = retriever.rerank(
        query="what is a subject?",
        search_results=[[]],
    )

    assert result == []
    retriever._reranker.compute_score.assert_not_called()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_integration_retrieve_and_rerank(integration_database_file):
    integration_retriever = create_integration_retriever(integration_database_file)
    node = RetrieveAndRerankNode(integration_retriever)

    result = await node(
        {
            "messages": [
                HumanMessage(content="what is a subject?")
            ],
            "rankedDocs": [],
        }
    )
    ranked_docs = result['rankedDocs']
    # Reranking returns at most the requested top five documents.
    assert result["query"] == "what is a subject?"
    assert 1 <= len(ranked_docs) <= 5
    assert all(isinstance(doc, Document) for doc in ranked_docs)

    # Each output has a numerical reranker score.
    scores = [doc.metadata["reranker_score"] for doc in ranked_docs]
    assert all(isinstance(score, (int, float)) for score in scores)

    # The reranker returns highest-scored documents first.
    assert scores == sorted(scores, reverse=True)
    integration_retriever._search_client.close()
