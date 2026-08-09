import os
from pathlib import Path

from docling.chunking import HybridChunker
from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
from langchain_docling import DoclingLoader
from langchain_docling.loader import ExportType
from pymilvus import MilvusClient
from transformers import AutoTokenizer

EMBED_MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
COLLECTION_NAME = "demo_collection"

def get_milvus_db_path():
    """Return the Milvus Lite database path for the current environment."""
    configured_path = os.getenv("MILVUS_DB_PATH")
    if configured_path:
        return configured_path
    ## 4 levels up the directory
    project_dir = Path(__file__).resolve().parents[3]
    return str(project_dir / "data" / "milvus" / "docling.db")

def get_embedding():
    from langchain_huggingface import HuggingFaceEmbeddings

    return HuggingFaceEmbeddings(
        model_name=EMBED_MODEL_ID,
        encode_kwargs={"normalize_embeddings": True},
    )


def ingest_pdf(file_path: str, client: MilvusClient):
    if client.has_collection(collection_name=COLLECTION_NAME):
        stats = client.get_collection_stats(collection_name=COLLECTION_NAME)
        if int(stats.get("row_count", 0)) > 0:
            return {
                "status": "skipped",
                "reason": "Milvus collection already contains data",
                "collection_name": COLLECTION_NAME,
            }

    else:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            dimension=384,
            metric_type="COSINE",
        )

    tokenizer = HuggingFaceTokenizer(
        tokenizer=AutoTokenizer.from_pretrained(EMBED_MODEL_ID),
        max_tokens=256,
    )

    loader = DoclingLoader(
        file_path=file_path,
        export_type=ExportType.DOC_CHUNKS,
        chunker=HybridChunker(tokenizer=tokenizer),
    )

    docs = loader.load()

    embedding = get_embedding()

    texts = []

    for doc in docs:
        texts.append(doc.page_content)

    vectors = embedding.embed_documents(texts)

    data = []

    for index in range(len(docs)):
        doc = docs[index]

        row = {
            "id": index,
            "vector": vectors[index],
            "text": doc.page_content,
            "source": doc.metadata,
        }

        data.append(row)

    result = client.insert(
        collection_name=COLLECTION_NAME,
        data=data,
    )

    return result
