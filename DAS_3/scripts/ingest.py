# ingest.py
import os

from pymilvus import MilvusClient

from das_agent.retrieval.ingestion import get_milvus_db_path, ingest_pdf

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # DAS_Agent/
file_path = os.getenv("INGEST_FILE_PATH", os.path.join(BASE_DIR, "data/seed/subject.pdf"))
if not os.path.isfile(file_path):
    raise FileNotFoundError(
        f"Ingest source file was not found: {file_path}. "
        "Commit the source document or set INGEST_FILE_PATH."
    )

client = MilvusClient(uri=get_milvus_db_path())
result = ingest_pdf(file_path, client)
print(result)
