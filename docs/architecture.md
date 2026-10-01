# Architecture Decision Record

## PRism Architecture

### Overview

PRism uses a strict separation between static analysis and AI reasoning.

```
Static Analysis → Factual Evidence → LLM Reasoning → Structured Report
```

The LLM is **never** asked to determine facts that can be computed programmatically.

---

### Component Architecture

```
prism/
├── apps/
│   ├── backend/           FastAPI application
│   │   ├── app/
│   │   │   ├── api/v1/    REST endpoints (repositories, analyses, webhooks)
│   │   │   ├── core/      Config, DB, logging
│   │   │   ├── models/    SQLAlchemy ORM
│   │   │   ├── schemas/   Pydantic v2 request/response models
│   │   │   └── services/  Business logic
│   │   │       ├── github_service.py    GitHub API client
│   │   │       ├── diff_parser.py       Unified diff → structured data
│   │   │       ├── impact_analyzer.py   Graph traversal for impact
│   │   │       ├── llm_service.py       LLM orchestration
│   │   │       └── analysis_pipeline.py Full orchestration
│   │   └── tests/
│   │
│   └── frontend/          Next.js 15 dashboard
│
└── packages/
    └── code-analysis/     Language-agnostic parsing
        ├── adapters/      Language-specific Tree-sitter adapters
        ├── models/        Common Intermediate Representation (CIR)
        └── graph/         NetworkX code graph
```

---

### Key Design Decisions

**1. Language-Agnostic CIR**
All language adapters output `FileAnalysis` (symbols + relationships), not language-specific ASTs. The rest of the application only sees the CIR.

**2. Async Pipeline**
Analysis runs in FastAPI BackgroundTasks (simple async, no worker process for MVP). Redis/Celery can replace this for scale.

**3. NetworkX over Neo4j**
For MVP, an in-memory NetworkX DiGraph is sufficient. Traversal for typical PRs (< 20 changed symbols, < 500 dependents) is fast.

**4. Structured LLM Output**
JSON schema enforced via OpenAI's `response_format={"type":"json_object"}`. Claude uses prompt-enforced JSON. Malformed output falls back to deterministic analysis.

**5. Evidence-First Prompting**
The LLM is given the full evidence package and explicitly instructed NOT to invent facts. Every risk factor must cite concrete file paths or symbol names.

**6. No OAuth for MVP**
GitHub PAT via environment variable. OAuth can be added without changing core logic.
