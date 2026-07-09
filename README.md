# D.I.A.L — DAS Individualised AI-Based Learning System

> An AI-powered learning-support platform built for the **Dyslexia Association of Singapore (DAS)**, helping learners who learn differently receive individualised, differentiated support.

**Course:** SUTD 50.003 — Elements of Software Construction · **Team:** C2T5
**Industry Partner:** Dyslexia Association of Singapore (DAS)

---

## Overview

DAS empowers people who learn differently — including those with dyslexia — to reach their potential. **D.I.A.L** is DAS's mega project suite to bring individualisation and differentiation to their programmes using AI. The full suite spans **seven** subsystems; this repository implements a **strongly-connected subset of three**:

| # | Subsystem | What it does |
|---|-----------|--------------|
| **DAS 1** | **Learning Screening Engine** | A non-diagnostic screening questionnaire that uses an ML model to indicate a learner's *likelihood* of conditions such as dyslexia or ADHD, and summarises results on an educator dashboard. |
| **DAS 3** | **Adaptive Learning Activity Generator** | Lets an educational therapist input a student profile and generates downloadable learning worksheets using Retrieval-Augmented Generation (RAG) over DAS teaching materials. |
| **DAS 7** | **Parent Insight Dashboard** | Lets parents track their child's educational progress with AI-generated summaries and recommendations, plus email notifications. |

> The remaining subsystems (DAS 2 Cognitive Profiling, DAS 4 Error Pattern Analyzer, DAS 5 Progress Monitoring, DAS 6 Intervention Recommendation) are **out of scope** for this repository.

---

## Subsystems in detail

### DAS 1 — Learning Screening Engine
- A **freely accessible, 24/7** screening test that routes users by age.
- Collects responses and sends them to an **ML classification model** that predicts literacy-risk indicators.
- Results are stored and surfaced to educators via a **dashboard summarising student performance**.
- **Non-diagnostic** — framed as a "fun questionnaire," not a clinical assessment.
- Personal data is **anonymised** (hashed user IDs; individuals are not identifiable by full name or NRIC).

### DAS 3 — Adaptive Learning Activity Generator
- An **educational therapist** submits requirements / a student profile.
- The system retrieves relevant DAS resources (policies, guidelines, teaching content) from a **knowledge base**, then prompts an **LLM** to generate worksheet content (RAG pipeline).
- The formatted worksheet is provided as a **downloadable attachment**.
- Proof-of-concept is scoped to **a single band level** (e.g. Band A) to manage complexity.

### DAS 7 — Parent Insight Dashboard
- Parents log in to a **role-secured** dashboard to track their child's progress.
- **Get Summary** (`<<include>>`) — an AI summary of the child's progress.
- **Get Recommendations** (`<<extend>>`) — AI-generated recommendations to help the child.
- **Notify Parent** — a scheduled job emails parents a short progress summary.

---

## Use cases

**General**
- Sign Up — user registers with email verification via an external email server.
- Log In — user authenticates with email/password + verification code.

**DAS 1 — Learning Screening Engine**
- Screen User — take a screening test → ML prediction → optionally store profile + results.

**DAS 3 — Adaptive Learning Activity Generator**
- Generate Worksheet — therapist requirements → RAG retrieval → LLM generation → download.

**DAS 7 — Parent Insight Dashboard**
- Track Child's Progress — includes *Get Summary*, extends *Get Recommendations*.
- Notify Parent — periodic email notification with a progress summary.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript (JSON over REST) |
| Screening ML (DAS 1) | ML classification model for literacy-risk prediction |
| Content generation (DAS 3) | RAG — vector database + embeddings + LLM API *(provider TBD)* |
| Summaries (DAS 7) | LLM API for summarisation & recommendations |
| Auth | JWT / Firebase Auth *(planned)* |
| Repo tooling | npm workspaces monorepo |

> **Not yet finalised:** hosting environment (local vs DAS/SUTD-provided — pending client ICT confirmation) and the specific LLM / vector-DB providers. No strict accuracy target is required; ~75–80% is acceptable for the proof of concept.

---

## Repository structure

```
ESC-C2T5/
├─ package.json          # root workspace manifest (private, workspaces)
├─ package-lock.json     # locked dependency versions for all workspaces
├─ client/               # React + Vite + TypeScript frontend
│  ├─ package.json
│  └─ tsconfig.json
├─ server/               # Express + TypeScript backend
│  ├─ package.json
│  └─ tsconfig.json
├─ Files/                # project handout, briefs, and reference materials
└─ README.md
```

---

## Getting started

**Prerequisites:** Node.js 18+ (20 LTS recommended) and npm 7+.

```bash
# 1. Install dependencies for all workspaces (run once, at the repo root)
npm install

# 2. Start the frontend dev server
npm run dev:client

# 3. In a second terminal, start the backend dev server
npm run dev:server
```

> The project is currently scaffolded (config only). The dev servers start once the entry
> source files are added — `client/index.html` + `client/src/main.tsx` for the frontend, and
> `server/src/index.ts` for the backend.

### Available scripts

**Root**
| Script | Action |
|--------|--------|
| `npm run dev:client` | Run the frontend dev server (`vite`) |
| `npm run dev:server` | Run the backend dev server (`tsx watch`) |
| `npm run build` | Build both workspaces |

**`client/`**
| Script | Action |
|--------|--------|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Type-check without emitting |

**`server/`**
| Script | Action |
|--------|--------|
| `npm run dev` | Run with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled server |
| `npm run typecheck` | Type-check without emitting |

---

## Development process & roadmap

The team follows an **iterative model** (Requirement → Design → Development → Testing → Deployment, repeated per iteration), chosen because the AI/ML components are hard to specify up-front and user feedback loops are expected.

| Weeks | Milestone | Focus |
|-------|-----------|-------|
| Week 7 | Setup | Repos, project setup, basic REST APIs, UI layouts, AI architecture & RAG workflow |
| Week 8 | **Project Meeting 2** | Connect UI ↔ backend over REST, refine API responses, begin unit testing (frontend + backend) |
| Weeks 9–10 | **Project Meeting 3** | Integration testing, verify RAG accuracy, error-state tests, end-to-end testing |
| Weeks 11–12 | Final | Robustness / fuzz testing (e.g. prompt-guideline bypass checks), report & documentation |

---

## Team

**C2T5** — Brian Wong, Toh Shijie, Patrick Liu, Michael Soh, Le Bin, Vincent Alexander, Mahek Zaveri, Jia Zhi.

Industry mentor: **Ms Soofrina Binte Mubarak** — Lead Educational Therapist, Dyslexia Association of Singapore.

---

## Notes & data handling

- The DAS 1 screener is **non-diagnostic** and must not be presented as a clinical assessment.
- User data is **anonymised** — hashed IDs only; no full names or NRIC stored in identifiable form.
- Teaching materials and other assets provided by DAS are the **industry partner's IP** and are shared under NDA. Do **not** commit DAS-provided datasets, documents, or credentials to this repository.
