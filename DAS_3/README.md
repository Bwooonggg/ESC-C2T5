# DAS Agent

Educational worksheet agent with a LangGraph Python backend and a React/Vite frontend.

## Repository layout

- `src/das_agent/graph/` — graph construction, deployment wiring, and state
- `src/das_agent/nodes/` — LangGraph node implementations
- `src/das_agent/retrieval/` — knowledge retrieval and document ingestion
- `src/das_agent/worksheet/` — worksheet prompts and schemas
- `frontend/` — React/Vite application and JavaScript tests
- `tests/` — Python tests
- `scripts/` — operational scripts such as document ingestion
- `data/seed/` — source documents used to seed retrieval
- `data/milvus/` — committed Milvus Lite deployment seed
- `docs/` — project documentation

Docker, Compose, LangGraph, and Shipit configuration remain at repository root because those tools use the repository as their build and deployment context.

## Environment

Copy `.env.example` to `.env` and fill in the required values. Both backend LLM calls use OpenRouter and the model configured by `OPENROUTER_MODEL`. Vite is configured to read this root environment file, including `VITE_LANGGRAPH_URL`.

`.env.shipit` is a separate, ignored deployment environment file used by `shipit.yaml` and `docker-compose.yml`.

## Backend setup

Python 3.12 is required.

```sh
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the LangGraph development server:

```sh
langgraph dev
```

Run Python tests:

```sh
python -m pytest tests/
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

## Full-stack Docker setup

Copy `.env.example` to `.env`, set `POSTGRES_PASSWORD` and the API keys, then run:

```sh
docker compose up --build
```

The frontend is available at `http://localhost:3000` by default. Its Nginx server
proxies the shared public prefix `/api/worksheet` to the LangGraph backend and
strips that prefix before forwarding. Vite applies the same rule during local
development. The browser therefore uses one same-origin URL in every environment.
Set `FRONTEND_PORT` to change the host port. For a separately hosted frontend,
set `VITE_LANGGRAPH_URL` to the public backend URL at frontend image build time.

This service still uses LangGraph's native thread/run protocol rather than the
JSON envelope used by DAS 7. JWT verification has not yet been added to the
LangGraph deployment; add it before exposing learner-specific worksheet data.

## Document ingestion

The ingestion script defaults to `data/seed/subject.pdf` and writes to `data/milvus/docling.db`:

```sh
PYTHONPATH=src python -m scripts.ingest
```
