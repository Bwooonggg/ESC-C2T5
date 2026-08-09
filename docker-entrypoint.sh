#!/bin/sh
set -eu

MILVUS_DB_PATH="${MILVUS_DB_PATH:-/app/data/milvus/docling.db}"
INGEST_FILE_PATH="${INGEST_FILE_PATH:-data/seed/subject.pdf}"
MILVUS_INGEST_MARKER="${MILVUS_INGEST_MARKER:-${MILVUS_DB_PATH}.seeded}"

export MILVUS_DB_PATH INGEST_FILE_PATH
mkdir -p "$(dirname "$MILVUS_DB_PATH")" "$(dirname "$MILVUS_INGEST_MARKER")"

if [ "${RUN_INGEST:-false}" = "true" ] && {
    [ "${FORCE_INGEST:-false}" = "true" ] ||
    [ ! -f "$MILVUS_INGEST_MARKER" ];
}; then
    if [ ! -f "$INGEST_FILE_PATH" ]; then
        echo "Missing Milvus seed document: $INGEST_FILE_PATH" >&2
        echo "Commit the source document or set INGEST_FILE_PATH." >&2
        exit 1
    fi

    echo "Seeding Milvus Lite from $INGEST_FILE_PATH..."
    python -m scripts.ingest
    touch "$MILVUS_INGEST_MARKER"
else
    echo "Milvus Lite seed already present; skipping ingest."
fi

exec langgraph dev \
    --no-reload \
    --allow-blocking \
    --host 0.0.0.0 \
    --port "${PORT:-10000}"
