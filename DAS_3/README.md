# DAS Agent

Educational worksheet agent with a LangGraph Python backend. The centralized root
frontend is intended to become the browser client for this service after frontend
integration is complete.

## Repository layout

- `src/das_agent/graph/` — graph construction, deployment wiring, and state
- `src/das_agent/nodes/` — LangGraph node implementations
- `src/das_agent/retrieval/` — knowledge retrieval and document ingestion
- `src/das_agent/worksheet/` — worksheet prompts and schemas
- `frontend/` — legacy React/Vite application and JavaScript tests
- `tests/` — Python tests
- `scripts/` — operational scripts such as document ingestion
- `data/seed/` — source documents used to seed retrieval
- `data/milvus/` — committed Milvus Lite deployment seed
- `docs/` — project documentation

Docker, Compose, and LangGraph configuration remain at repository root because
those tools use the repository as their build and deployment context.

## Environment

Copy `.env.example` to the ignored `.env` file and fill in the required values.
The backend uses OpenRouter and the model configured by `OPENROUTER_MODEL`.
Docker Compose loads this same file for the DAS3 backend stack. `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and the optional `SUPABASE_JWKS_URL` are backend-only
settings; never copy the service-role key into browser configuration.

## Backend setup

Python 3.12 is required.

```sh
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

Run the LangGraph development server:

```sh
langgraph dev
```

Run Python tests:

```sh
python -m pytest tests/
pip install hypothesis
```

Integration tests use the committed Milvus seed and may download or load model weights:

```sh
python -m pytest -m integration tests/
```

## Frontend setup

```sh
cd frontend
npm install
npm run dev
```

Run JavaScript tests:

```sh
cd frontend
npm test
```

## Docker backend stack

Copy `.env.example` to `.env`, set `POSTGRES_PASSWORD`, provider credentials, and
the Supabase backend credentials, then run:

```sh
docker compose up --build
```

Compose starts only the LangGraph backend, PostgreSQL, and Redis. LangGraph is
available at `http://localhost:2024`; the root Vite frontend proxies
`/api/worksheet` to that address during local development. PostgreSQL, Redis, and
the Hugging Face model cache use named volumes, while Milvus Lite remains at
`/app/data/milvus/docling.db` in the backend image.

`langgraph dev` uses its in-memory development runtime. Its thread and run state
is persisted across Compose container recreation by the `langgraph-state` named
volume mounted at `/app/.langgraph_api`; the retained PostgreSQL and Redis
services are not used by this runtime. A PostgreSQL-backed LangGraph deployment
requires `langgraph up` with the required LangSmith deployment credential.

This service still uses LangGraph's native thread/run protocol rather than the
JSON envelope used by DAS 7. Its LangGraph deployment verifies Supabase JWTs
against the project JWKS and permits only teacher profiles. New threads are
stamped with the JWT subject as `metadata.owner`; all thread and run operations
are filtered to that owner. Older threads without that metadata are therefore
inaccessible without deleting the persisted LangGraph data.

## Document ingestion

The ingestion script defaults to `data/seed/subject.pdf` and writes to `data/milvus/docling.db`:

```sh
PYTHONPATH=src python -m scripts.ingest
```
