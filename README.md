# PRism 🔍

> **AI-Powered GitHub Pull Request Risk Analyzer**

PRism analyzes GitHub Pull Requests using **Tree-sitter static analysis** + **LLM reasoning** to produce evidence-backed risk reports. It tells you *exactly* which parts of your codebase could be affected by a PR — before it merges.

![Risk Level](https://img.shields.io/badge/Risk-HIGH-ff4d6d?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-Python%20%7C%20JS%20%7C%20TS%20%7C%20Go-6c63ff?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-26de81?style=flat-square)

---

## Problem Statement

Code reviews are hard. Reviewers must mentally trace:
- What changed?
- What depends on what changed?
- What could break?
- What tests are missing?

PRism automates this using static analysis + AI — giving reviewers **concrete, evidence-backed** answers rather than guesses.

---

## Architecture

```
GitHub PR
    │
    ▼
FastAPI Backend
    │
    ├── GitHub API Service
    │       └── Fetch PR metadata, diff, files
    │
    ├── Tree-sitter Parser (language-agnostic)
    │       ├── PythonAnalyzer
    │       ├── JavaScriptAnalyzer
    │       ├── TypeScriptAnalyzer
    │       └── GoAnalyzer
    │
    ├── Code Graph (NetworkX)
    │       └── Nodes: files, classes, functions
    │       └── Edges: CALLS, IMPORTS, EXTENDS, TESTS
    │
    ├── Impact Analyzer
    │       └── Traverse graph for dependents
    │
    ├── Evidence Package Builder
    │
    ├── LLM Service (OpenAI / Anthropic)
    │       └── Reasons over evidence → structured JSON
    │
    └── PostgreSQL (results)

Next.js Frontend
    ├── Repository dashboard
    ├── PR list
    ├── Analysis progress (live polling)
    └── Results: risk, impact, tests, evidence
```

---

## Core Design Principle

```
STATIC ANALYSIS  →  FACTUAL EVIDENCE  →  LLM REASONING  →  RISK REPORT
```

The LLM **never invents facts**. It reasons over concrete evidence from static analysis:
- Changed symbols (from Tree-sitter + diff)
- Dependency graph traversal (via NetworkX)
- Test relationships (structural + naming conventions)
- Risk signals (deterministic boolean flags)

---

## Why Tree-sitter?

- **Language-agnostic**: one AST API for all languages
- **Fast**: incremental parsing in milliseconds
- **Robust**: handles syntax errors gracefully
- **Extensible**: add a language by adding a grammar + adapter

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.12 |
| Database | PostgreSQL + pgvector |
| Queue | Redis (background tasks via FastAPI BackgroundTasks) |
| Parser | Tree-sitter (Python, JS, TS, Go) |
| Graph | NetworkX |
| AI | OpenAI GPT-4o-mini / Anthropic Claude |
| Frontend | Next.js 15, TypeScript |
| Docker | Docker Compose |

---

## Supported Languages

| Language | Extensions | Status |
|---|---|---|
| Python | `.py` | ✅ Full Tree-sitter |
| JavaScript | `.js`, `.jsx`, `.mjs` | ✅ Full Tree-sitter |
| TypeScript | `.ts`, `.tsx` | ✅ Full Tree-sitter |
| Go | `.go` | ✅ Full Tree-sitter |
| Java | `.java` | 🔜 Planned |
| Rust | `.rs` | 🔜 Planned |

---

## Setup

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 16 (or Docker)
- Redis (or Docker)

### 1. Clone & Install

```bash
git clone <repo>
cd github-pr-analyser
make install
```

### 2. Configure Environment

```bash
cp .env.example apps/backend/.env
# Edit apps/backend/.env with your keys
```

**Required:**
- `GITHUB_TOKEN` — GitHub PAT with `repo` + `read:org` scopes
- `OPENAI_API_KEY` — or `ANTHROPIC_API_KEY` if using Anthropic

### 3. Start Services

**With Docker (recommended):**
```bash
docker compose up -d
```

**Without Docker:**
```bash
# Terminal 1: Backend
make dev-backend

# Terminal 2: Frontend
make dev-frontend
```

Open `http://localhost:3000`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection URL |
| `GITHUB_TOKEN` | ✅ | GitHub Personal Access Token |
| `GITHUB_WEBHOOK_SECRET` | Optional | For webhook signature validation |
| `LLM_PROVIDER` | Optional | `openai` (default) or `anthropic` |
| `OPENAI_API_KEY` | ✅* | Required if using OpenAI |
| `OPENAI_MODEL` | Optional | Default: `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | ✅* | Required if using Anthropic |
| `ANTHROPIC_MODEL` | Optional | Default: `claude-3-5-haiku-20241022` |
| `DEBUG` | Optional | Enable debug logging |

---

## API Documentation

Full interactive docs at `http://localhost:8000/docs`

### Key Endpoints

```
POST /api/v1/repositories                          Add a repository
GET  /api/v1/repositories                          List repositories
GET  /api/v1/repositories/{id}/pull-requests       List open PRs

POST /api/v1/repositories/{id}/pull-requests/{n}/analyze   Trigger analysis
GET  /api/v1/analyses/{id}                         Full analysis result
GET  /api/v1/analyses/{id}/status                  Poll status
GET  /api/v1/analyses/{id}/risk                    Risk portion only
GET  /api/v1/analyses/{id}/impact                  Impact portion only
GET  /api/v1/analyses/{id}/tests                   Test portion only

POST /api/v1/webhooks/github                       GitHub webhook receiver
GET  /api/v1/health                                Health check
```

---

## Analysis Pipeline

1. Fetch PR metadata & file list from GitHub API
2. Parse repository files with Tree-sitter
3. Build language-agnostic dependency graph (NetworkX)
4. Identify changed symbols by overlapping diff line ranges with AST
5. Traverse graph to find callers, importers, dependents
6. Identify related test files
7. Calculate deterministic risk signals
8. Build evidence package
9. Send evidence to LLM for structured risk analysis
10. Persist and return results

---

## Example Analysis Output

```json
{
  "risk_level": "HIGH",
  "summary": "PR modifies core payment processing. 9 downstream dependents detected.",
  "risk_factors": [
    {
      "title": "Core payment service modified",
      "description": "PaymentService.process_payment is called by 4 other services",
      "evidence": ["payments/service.py:20-55"]
    }
  ],
  "recommended_tests": [
    { "test_name": "test_currency_conversion_failure", "priority": "HIGH" },
    { "test_name": "test_payment_timeout", "priority": "MEDIUM" }
  ]
}
```

---

## Running Tests

```bash
make test
# or
cd apps/backend && pytest tests/ -v
```

---

## Webhook Setup

1. Go to your GitHub repo → Settings → Webhooks
2. Payload URL: `https://your-domain.com/api/v1/webhooks/github`
3. Content type: `application/json`
4. Events: Pull requests
5. Set the same `GITHUB_WEBHOOK_SECRET` in your `.env`

---

## Known Limitations

- Tree-sitter captures syntactic structure; semantic cross-file analysis is based on name matching
- LLM analysis quality depends on model and context quality
- Very large repos (>500 files) may be partially analyzed (file cap applies)
- No OAuth yet — uses Personal Access Token

---

## Future Improvements

- GitHub App + OAuth authentication
- Automatic PR comments with analysis results
- pgvector semantic code search (embeddings)
- Java, Rust, C# language adapters
- Historical PR comparison
- CI/CD integration (GitHub Actions)
- Organization-level risk rule customization
- SSE live progress streaming
