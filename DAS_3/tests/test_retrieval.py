from pathlib import Path

import pytest
from langchain_core.messages import HumanMessage
from pymilvus import MilvusClient
from das_agent.retrieval.ingestion import get_embedding, get_milvus_db_path
from das_agent.retrieval.knowledge_retriever import KnowledgeBaseRetriever
from das_agent.nodes.nodes import RetrieveAndRerankNode
from langchain_core.documents import Document
from unittest.mock import Mock
from FlagEmbedding import FlagReranker

database_file = Path(__file__).resolve().parent / ".." / "data" / "milvus" / "docling.db"

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

def create_integration_retriever():
    return KnowledgeBaseRetriever(
        embedding_model=get_embedding(),
        search_client=MilvusClient(uri=str(database_file)),
        reranker=FlagReranker("BAAI/bge-reranker-base", use_fp16=False),
    )


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
def test_subject_search():
    client = MilvusClient(uri=str(database_file))
    client.load_collection(collection_name="demo_collection")

    embedding = get_embedding()
    query = embedding.embed_query("What is a subject?")

    res = client.search(
        collection_name="demo_collection",
        data=[query],
        limit=3,
        output_fields=["text", "source"],
    )

    assert res, "Search returned no results"
    assert len(res) == 1, "Expected one query result set"
    assert len(res[0]) <= 3, "Expected 3 or less results"

@pytest.mark.integration
def test_rerank():
    integration_retriever = create_integration_retriever()
    docs = integration_retriever.retrieve("what is a subject?", 5)
    result = integration_retriever.rerank("what is a subject?", docs, 10)
    assert len(docs) == 1
    assert len(docs[0]) == 5, "Expected 5 results"
    assert 1 < len(result) <= 10
    doc_fields(result)


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


@pytest.mark.integration
@pytest.mark.asyncio
async def test_integration_retrieve_and_rerank():
    from das_agent.graph.deployment_graph import graph_dev_instance

    result = await graph_dev_instance.nodes["retrieve_and_rerank"].ainvoke(
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
