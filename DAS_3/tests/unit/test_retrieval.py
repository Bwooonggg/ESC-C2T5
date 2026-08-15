from pathlib import Path

import pytest
from langchain_core.messages import HumanMessage
from das_agent.retrieval.ingestion import get_milvus_db_path
from das_agent.retrieval.knowledge_retriever import KnowledgeBaseRetriever
from das_agent.nodes.nodes import RetrieveAndRerankNode
from unittest.mock import Mock

retriever = KnowledgeBaseRetriever(
        embedding_model=Mock(),
        search_client=Mock(),
        reranker=Mock(),
        )


def test_default_db_path(monkeypatch):
    monkeypatch.delenv("MILVUS_DB_PATH", raising=False)

    expected_path = Path(__file__).resolve().parents[2] / "data" / "milvus" / "docling.db"

    assert Path(get_milvus_db_path()) == expected_path


@pytest.mark.asyncio
async def test_combined_retrieval_query():
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


def test_empty_rerank():
    retriever._reranker.compute_score.reset_mock()

    result = retriever.rerank(
        query="what is a subject?",
        search_results=[[]],
    )

    assert result == []
    retriever._reranker.compute_score.assert_not_called()


def test_retrieve_and_rerank_empty_search_skips_reranker():
    embedding = Mock()
    embedding.embed_query.return_value = [0.1, 0.2]
    search_client = Mock()
    search_client.search.return_value = [[]]
    reranker = Mock()
    empty_retriever = KnowledgeBaseRetriever(
        embedding_model=embedding,
        search_client=search_client,
        reranker=reranker,
    )

    result = empty_retriever.retrieve_and_rerank("missing topic")

    assert result == []
    reranker.compute_score.assert_not_called()


def test_retrieve_propagates_embedding_failure_without_search():
    embedding = Mock()
    embedding.embed_query.side_effect = RuntimeError("embedding unavailable")
    search_client = Mock()
    failure_retriever = KnowledgeBaseRetriever(
        embedding_model=embedding,
        search_client=search_client,
        reranker=Mock(),
    )

    with pytest.raises(RuntimeError, match="embedding unavailable"):
        failure_retriever.retrieve("fractions", top_k=5)

    search_client.search.assert_not_called()


def test_retrieve_and_rerank_propagates_search_failure_without_reranking():
    embedding = Mock()
    embedding.embed_query.return_value = [0.1, 0.2]
    search_client = Mock()
    search_client.search.side_effect = RuntimeError("vector store unavailable")
    reranker = Mock()
    failure_retriever = KnowledgeBaseRetriever(
        embedding_model=embedding,
        search_client=search_client,
        reranker=reranker,
    )

    with pytest.raises(RuntimeError, match="vector store unavailable"):
        failure_retriever.retrieve_and_rerank("fractions")

    reranker.compute_score.assert_not_called()
