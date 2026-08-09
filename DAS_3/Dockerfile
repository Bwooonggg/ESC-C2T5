FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PYTHONPATH=/app/src \
    PORT=10000 \
    MILVUS_DB_PATH=/app/data/milvus/docling.db \
    RUN_INGEST=false \
    HF_HOME=/data/huggingface

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libmagic1 \
        libsm6 \
        libxext6 \
        libxrender1 \
        poppler-utils && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
COPY pyproject.toml .
RUN pip install --no-cache-dir --no-deps \
        --index-url https://download.pytorch.org/whl/cpu \
        torch==2.13.0 \
        torchvision==0.28.0
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/render-entrypoint.sh
RUN chmod 0755 /usr/local/bin/render-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/render-entrypoint.sh"]
