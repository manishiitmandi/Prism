You are a senior staff software engineer and AI engineer. Your task is to design and implement a production-quality MVP called "PRism" (name can be changed later): a language-agnostic AI Pull Request Risk Analyzer.

The goal is to build a portfolio-quality SDE + GenAI project that analyzes GitHub Pull Requests, determines which parts of a codebase may be affected by the changes, identifies potential risks and missing tests, and produces an evidence-backed AI review.

IMPORTANT:
- This is a one-week project.
- Prioritize a complete, working, polished MVP over excessive features.
- Do NOT over-engineer.
- The architecture MUST be language-agnostic.
- The system should support multiple programming languages through a pluggable parser/adapter architecture.
- Static analysis should provide factual evidence.
- The LLM should reason over that evidence rather than inventing repository facts.
- The system must be useful even if the LLM is unavailable for parts of the analysis.
- Code should be clean, modular, typed, tested, documented, and Docker-friendly.

==================================================
1. PRODUCT VISION
==================================================

Build an AI-powered GitHub Pull Request Risk Analyzer.

A developer connects a GitHub repository and selects a Pull Request.

The system analyzes:

1. What files changed?
2. What functions/classes/symbols changed?
3. What files/functions depend on those changed components?
4. What tests are related to the changed functionality?
5. What parts of the application could be affected?
6. What potential risks exist?
7. What tests should be added or modified?
8. Why does the system believe the PR is risky?

The final output should be an evidence-backed report.

Example:

PR #142
"Refactor payment processing"

Risk: HIGH

Changed:
- payments/service.py
- payments/model.py

Potentially affected:
- orders/service.py
- checkout/service.py
- api/orders.py

Risk factors:
- Core payment service modified
- Database model changed
- 7 downstream dependents detected
- No tests found for the new currency conversion path

Recommended tests:
- currency conversion failure
- unsupported currency
- duplicate payment
- payment timeout

Every important AI conclusion should reference concrete repository evidence.

==================================================
2. CORE DESIGN PRINCIPLE
==================================================

Use this separation:

STATIC ANALYSIS
    ↓
FACTUAL EVIDENCE
    ↓
RETRIEVAL
    ↓
LLM REASONING
    ↓
STRUCTURED RISK REPORT

Do NOT make the LLM responsible for basic facts that can be determined programmatically.

For example:

Do NOT ask:
"Which files depend on PaymentService?"

Instead:

Tree-sitter / static analysis:
PaymentService
    ↓
OrderService
    ↓
Orders API

Then provide that evidence to the LLM.

The LLM should answer:
"Given these dependencies and the changes, what risks should the developer investigate?"

This separation is a core feature of the architecture.

==================================================
3. LANGUAGE AGNOSTIC REQUIREMENT
==================================================

The project MUST NOT be designed specifically around Python.

Use Tree-sitter as the primary syntax parsing technology.

The architecture should support at least:

- Python
- JavaScript
- TypeScript
- Java
- Go

The architecture should make adding another language straightforward.

A new language should ideally require:

1. Tree-sitter grammar
2. Language-specific adapter
3. Mapping into the common intermediate representation

The rest of the application must not need to know language-specific syntax.

==================================================
4. LANGUAGE ADAPTER ARCHITECTURE
==================================================

Create a common abstraction similar to:

LanguageAnalyzer

Responsibilities:

- extract symbols
- extract functions
- extract classes
- extract imports
- extract calls
- extract inheritance/implementation relationships where possible
- identify test files
- identify definitions
- identify references

Conceptually:

LanguageAnalyzer
├── PythonAnalyzer
├── JavaScriptAnalyzer
├── TypeScriptAnalyzer
├── JavaAnalyzer
└── GoAnalyzer

Do not tightly couple these implementations to the rest of the application.

All adapters should output a common intermediate representation.

==================================================
5. COMMON CODE REPRESENTATION
==================================================

Create a language-independent representation of a repository.

For example:

Repository
    ↓
File
    ↓
Symbol
    ↓
Function / Class / Method / Variable / Test

Represent relationships such as:

- CONTAINS
- DEFINES
- IMPORTS
- CALLS
- REFERENCES
- EXTENDS
- IMPLEMENTS
- TESTS
- DEPENDS_ON

Example:

payments/service.py
    DEFINES
        PaymentService
            DEFINES
                process_payment

orders/service.py
    CALLS
        PaymentService.process_payment

This common representation is the foundation of the impact analysis.

==================================================
6. UNIVERSAL CODE GRAPH
==================================================

Build a code dependency graph.

The graph should be language-independent.

Example:

Frontend
    |
    | API_CALL
    ↓
Backend API
    |
    | CALLS
    ↓
PaymentService
    |
    | CALLS
    ↓
PaymentGateway

A PR modifying PaymentService should be able to identify potentially affected downstream components.

For the MVP, do not introduce Neo4j unless genuinely necessary.

Use PostgreSQL or an in-memory graph representation with NetworkX where appropriate.

Prefer simple architecture.

==================================================
7. GITHUB INTEGRATION
==================================================

Integrate with GitHub.

The system should be able to:

1. Accept a GitHub repository
2. Fetch repository metadata
3. Fetch Pull Request metadata
4. Fetch changed files
5. Fetch PR diff
6. Fetch relevant source files
7. Fetch tests
8. Optionally receive GitHub webhook events

Support:

- PR opened
- PR synchronized/updated
- PR reopened

Use GitHub REST API initially.

Do not spend the whole project implementing OAuth.

For MVP, a GitHub Personal Access Token can be configured through environment variables.

Design authentication so OAuth can be added later.

==================================================
8. WEBHOOK ARCHITECTURE
==================================================

Create an endpoint:

POST /api/v1/webhooks/github

The webhook should:

1. Validate the webhook signature when configured
2. Extract repository and PR information
3. Create an analysis job
4. Push the job into a queue
5. Immediately return HTTP 202

Do NOT perform the entire analysis synchronously inside the webhook request.

Example:

GitHub
  ↓
Webhook
  ↓
FastAPI
  ↓
Redis Queue
  ↓
Analysis Worker

==================================================
9. ASYNCHRONOUS PROCESSING
==================================================

Use Redis + a lightweight background worker system.

The analysis pipeline may involve:

- GitHub API requests
- repository downloads
- parsing
- embedding generation
- LLM calls

Therefore analysis must be asynchronous.

Expose analysis status:

GET /api/v1/analyses/{analysis_id}

Possible states:

QUEUED
CLONING
PARSING
ANALYZING
RETRIEVING
AI_ANALYSIS
COMPLETED
FAILED

The frontend should be able to poll the status.

If practical, use Server-Sent Events for live progress, but do NOT sacrifice MVP stability for this.

==================================================
10. PR ANALYSIS PIPELINE
==================================================

Implement this pipeline:

STEP 1:
Receive PR.

STEP 2:
Fetch PR metadata.

STEP 3:
Fetch PR diff.

STEP 4:
Identify changed files.

STEP 5:
Determine languages.

STEP 6:
Parse repository using Tree-sitter.

STEP 7:
Extract symbols and relationships.

STEP 8:
Construct universal code graph.

STEP 9:
Identify changed symbols.

STEP 10:
Perform impact analysis.

STEP 11:
Identify related tests.

STEP 12:
Index/retrieve relevant code.

STEP 13:
Build evidence package.

STEP 14:
Send evidence to LLM.

STEP 15:
Generate structured risk analysis.

STEP 16:
Store results.

STEP 17:
Expose results through API.

STEP 18:
Display results in frontend.

==================================================
11. DIFF ANALYSIS
==================================================

For every changed file determine:

- path
- language
- lines added
- lines removed
- changed line ranges
- changed symbols where possible

Example:

{
  "file": "payments/service.py",
  "language": "python",
  "added_lines": 18,
  "removed_lines": 7,
  "changed_symbols": [
    "PaymentService.process_payment"
  ]
}

Do not rely solely on LLM to identify changed symbols.

Use diff + Tree-sitter.

==================================================
12. IMPACT ANALYSIS
==================================================

For each changed symbol:

1. Find callers
2. Find importers
3. Find dependents
4. Find related classes/modules
5. Find tests

Example:

Changed:

PaymentService.process_payment()

Graph:

PaymentService.process_payment()
        ↓
OrderService.create_order()
        ↓
OrdersController.create_order()

Potentially affected:

- orders/service.py
- api/orders.py
- tests/test_orders.py

Calculate useful deterministic metrics:

- number of direct dependents
- number of transitive dependents
- number of affected modules
- number of affected tests
- whether public API code changed
- whether database/schema code changed
- whether configuration/deployment code changed

==================================================
13. TEST ANALYSIS
==================================================

Identify test files and test relationships.

Use conventions where possible:

Python:
tests/
test_*.py
*_test.py

JavaScript/TypeScript:
*.test.*
*.spec.*

Go:
*_test.go

Java:
src/test/
*Test.java

But also use semantic/structural relationships where possible.

For changed symbols, find tests that:

- call them
- import them
- are in the same module
- reference related functionality

Determine:

- tests affected
- tests present
- obvious missing test coverage candidates

Do NOT claim actual code coverage unless coverage data is available.

Never fabricate coverage percentages.

==================================================
14. CODE INDEXING / RAG
==================================================

Create a repository indexing pipeline.

Do NOT send the entire repository to the LLM.

Chunk relevant source code.

Each chunk should contain metadata:

- repository
- branch/commit
- file path
- language
- symbol name
- start line
- end line
- symbol type

Generate embeddings.

Use PostgreSQL + pgvector if practical.

Example metadata:

{
  "file": "payments/service.py",
  "symbol": "PaymentService.process_payment",
  "language": "python",
  "start_line": 20,
  "end_line": 55
}

Retrieve relevant code based on:

- changed symbols
- changed files
- dependency graph
- test relationships
- semantic search

==================================================
15. EVIDENCE PACKAGE
==================================================

Before calling the LLM, create an explicit evidence object.

Example:

{
  "pr": {
    "number": 142,
    "title": "Refactor payment processing"
  },

  "changed_files": [
    "payments/service.py",
    "payments/model.py"
  ],

  "changed_symbols": [
    "PaymentService.process_payment"
  ],

  "affected_components": [
    "OrderService.create_order",
    "CheckoutService.checkout"
  ],

  "dependency_metrics": {
    "direct_dependents": 4,
    "transitive_dependents": 9
  },

  "related_tests": [
    "tests/test_payment.py",
    "tests/test_orders.py"
  ],

  "missing_test_candidates": [
    "currency conversion",
    "payment timeout"
  ],

  "relevant_code": [...]
}

This evidence package is what the LLM reasons over.

==================================================
16. LLM ROLE
==================================================

The LLM should perform:

1. PR summary
2. Risk classification
3. Risk reasoning
4. Semantic impact interpretation
5. Test recommendations
6. Potential edge cases
7. Developer-facing explanation

The LLM should NOT invent:

- dependencies
- files
- functions
- test coverage
- API relationships
- database relationships

If evidence is insufficient, explicitly say:

"Insufficient evidence."

==================================================
17. STRUCTURED LLM OUTPUT
==================================================

Use structured output / JSON schema.

Example:

{
  "summary": "...",

  "risk_level": "LOW | MEDIUM | HIGH",

  "risk_factors": [
    {
      "title": "...",
      "description": "...",
      "evidence": [
        "payments/service.py:20-55",
        "orders/service.py:80"
      ]
    }
  ],

  "affected_components": [
    {
      "component": "...",
      "reason": "...",
      "evidence": [...]
    }
  ],

  "recommended_tests": [
    {
      "test_name": "...",
      "reason": "...",
      "priority": "HIGH | MEDIUM | LOW"
    }
  ],

  "edge_cases": [
    "..."
  ]
}

Do not use free-form LLM output as the primary backend contract.

==================================================
18. RISK CLASSIFICATION
==================================================

Do not make risk classification purely subjective.

Create deterministic risk signals first.

Potential signals:

- number of changed files
- number of changed symbols
- number of downstream dependents
- public API modified
- database/schema modified
- authentication/authorization code modified
- payment/security-sensitive code modified
- configuration/deployment code modified
- tests changed
- tests absent
- high dependency centrality

Create a risk evidence summary.

Then let the LLM interpret those signals.

Example:

{
  "signals": {
    "changed_files": 8,
    "affected_components": 14,
    "public_api_changed": true,
    "database_changed": true,
    "tests_changed": false
  }
}

The LLM then produces the final LOW/MEDIUM/HIGH classification and explanation.

Do NOT claim that this is a mathematically validated risk score.

==================================================
19. API DESIGN
==================================================

Create clean REST APIs.

Suggested endpoints:

POST /api/v1/repositories

GET /api/v1/repositories

GET /api/v1/repositories/{id}

POST /api/v1/repositories/{id}/pull-requests/{pr_number}/analyze

GET /api/v1/analyses/{analysis_id}

GET /api/v1/analyses/{analysis_id}/risk

GET /api/v1/analyses/{analysis_id}/impact

GET /api/v1/analyses/{analysis_id}/tests

POST /api/v1/webhooks/github

GET /api/v1/health

Use Pydantic request/response models.

Keep API versioning.

==================================================
20. DATABASE
==================================================

Use PostgreSQL.

Suggested entities:

repositories
pull_requests
analyses
changed_files
symbols
dependencies
tests
risk_factors
recommendations

Avoid unnecessary normalization if it makes the MVP harder.

Use migrations.

Use SQLAlchemy or SQLModel.

Do not store secrets in the database.

==================================================
21. FRONTEND
==================================================

Build a polished but simple Next.js dashboard.

Main page:

Repository list

Repository details:

- recent PRs
- analysis status

PR analysis page:

--------------------------------------------------
PR #142
Refactor Payment Processing

HIGH RISK

Summary:
...

--------------------------------------------------
Risk Factors

⚠ PaymentService modified
⚠ 9 downstream dependents
⚠ Database model changed
⚠ No related tests detected

--------------------------------------------------
Impact Analysis

PaymentService
      ↓
OrderService
      ↓
Orders API

--------------------------------------------------
Changed Files

payments/service.py
payments/model.py

--------------------------------------------------
Recommended Tests

1. test_currency_conversion
2. test_payment_timeout
3. test_duplicate_payment

--------------------------------------------------
Evidence

payments/service.py:20-55
orders/service.py:80-112

--------------------------------------------------

The UI should prioritize clarity over visual complexity.

==================================================
22. GRAPH VISUALIZATION
==================================================

Show an interactive dependency graph if practical.

Nodes:

- file
- class
- function
- API
- test

Edges:

- calls
- imports
- depends_on
- tests

Use React Flow or another lightweight graph library.

If the graph becomes too complex, show only the relevant subgraph for the PR.

Do NOT render the entire repository graph by default.

==================================================
23. SECURITY
==================================================

Implement basic security correctly.

Requirements:

- never expose GitHub tokens to frontend
- store secrets in environment variables
- validate GitHub webhook signatures
- sanitize repository/file input
- avoid executing arbitrary repository code
- never automatically execute untrusted code in the MVP
- use read-only GitHub permissions where possible
- do not send secrets/config files to the LLM
- exclude files such as:
  .env
  *.pem
  private keys
  credentials
  secrets

Do not execute arbitrary PR code.

==================================================
24. LLM SAFETY / HALLUCINATION CONTROL
==================================================

The LLM should be explicitly instructed:

"You must only make repository-specific claims using the supplied evidence."

Every important conclusion should have evidence.

If evidence is unavailable:

"Insufficient evidence to determine."

Do not fabricate:

- functions
- dependencies
- test coverage
- API endpoints
- files

==================================================
25. ERROR HANDLING
==================================================

Handle:

- GitHub API failure
- GitHub rate limiting
- repository not found
- invalid PR
- unsupported language
- parser failure
- embedding failure
- LLM timeout
- LLM rate limit
- malformed LLM output
- database failure
- worker failure

Implement retries only where appropriate.

Use exponential backoff for external API failures.

Do not retry permanent errors.

==================================================
26. OBSERVABILITY
==================================================

Add structured logging.

Every analysis should have:

analysis_id
repository_id
pr_number
stage
duration
status

Example:

[analysis=abc123]
stage=AST_ANALYSIS
duration=2.31s
status=success

Track:

- GitHub API latency
- parsing time
- embedding time
- LLM latency
- total analysis time

Do not log secrets.

==================================================
27. CACHING
==================================================

Avoid re-indexing the entire repository for every PR.

Use commit SHA.

Repository index:

repository + commit SHA

If the same commit is analyzed again, reuse the index.

For MVP:

- cache repository analysis
- cache embeddings
- cache GitHub responses where reasonable

==================================================
28. DOCKER
==================================================

Create Docker support.

Services:

frontend
backend
worker
postgres
redis

Prefer docker-compose for local development.

Example:

docker compose up

should start the complete local environment.

Do not require Kubernetes.

==================================================
29. TESTING
==================================================

Create tests for:

Backend:

- webhook endpoint
- GitHub service
- diff parser
- language detection
- common code representation
- impact analysis
- risk signal calculation
- LLM output validation

Integration:

- PR analysis pipeline with mocked GitHub API
- mocked LLM

Frontend:

- basic rendering
- analysis result rendering

Do not call real LLM/GitHub APIs in unit tests.

Use mocks.

==================================================
30. PROJECT STRUCTURE
==================================================

Use a clean monorepo.

Suggested:

prism/
│
├── apps/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── core/
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   ├── services/
│   │   │   ├── workers/
│   │   │   └── main.py
│   │   └── tests/
│   │
│   └── frontend/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── tests/
│
├── packages/
│   └── code-analysis/
│       ├── adapters/
│       ├── parser/
│       ├── models/
│       ├── graph/
│       └── tests/
│
├── docker/
├── docs/
├── docker-compose.yml
├── .env.example
├── README.md
└── Makefile

Keep boundaries clean.

==================================================
31. CODE QUALITY
==================================================

Use:

Python:
- Ruff
- MyPy
- pytest
- Pydantic
- SQLAlchemy

Frontend:
- TypeScript
- ESLint
- Prettier

Use type hints.

Avoid giant files.

Avoid deeply nested functions.

Keep business logic out of API routes.

Use dependency injection where useful.

==================================================
32. MVP PRIORITIES
==================================================

Priority P0 — MUST WORK

1. GitHub PR retrieval
2. PR diff analysis
3. multi-language detection
4. Tree-sitter parsing
5. common code representation
6. dependency/impact analysis
7. test identification
8. LLM risk analysis
9. structured output
10. PostgreSQL persistence
11. API
12. frontend dashboard

P1 — IMPORTANT

13. GitHub webhook
14. Redis worker
15. code embeddings
16. pgvector retrieval
17. dependency graph visualization
18. evidence citations

P2 — ONLY IF TIME REMAINS

19. GitHub OAuth
20. automatic PR comments
21. SSE live progress
22. advanced graph algorithms
23. additional languages
24. historical PR comparison
25. custom organization rules

Do not work on P2 until P0 and P1 are stable.

==================================================
33. WHAT NOT TO BUILD
==================================================

Do NOT build:

- a generic chatbot
- multi-agent swarm
- autonomous code modification
- automatic merging
- automatic code execution
- Kubernetes deployment
- complex authentication system
- billing
- organization management
- mobile application
- dozens of UI pages
- custom ML model
- proprietary code parser

The goal is a focused developer tool.

==================================================
34. IDEAL USER FLOW
==================================================

User:

1. Opens application.
2. Adds GitHub repository.
3. Selects a PR.
4. Clicks "Analyze PR".
5. Backend creates analysis job.
6. UI shows:
   "Queued → Parsing → Impact Analysis → AI Analysis → Complete"
7. User sees report.

Example final report:

PR #142
Refactor Payment Processing

Risk: HIGH

Summary:
The PR modifies the core payment processing flow and changes
currency handling. Static analysis identified 9 downstream
dependents across the order and checkout services.

Risk Factors:

1. Core payment service changed
   Evidence:
   payments/service.py:20-55

2. Database model changed
   Evidence:
   payments/model.py:10-38

3. Multiple downstream dependents
   Evidence:
   OrderService
   CheckoutService
   OrdersController

4. Missing related tests
   Evidence:
   No tests reference the new currency conversion branch.

Recommended Tests:

HIGH:
- unsupported currency
- conversion failure

MEDIUM:
- duplicate payment
- payment timeout

Potentially Affected:

payments/service.py
orders/service.py
checkout/service.py
api/orders.py

==================================================
35. DEMO REPOSITORY
==================================================

Create or use a small multi-language demo repository for testing.

Ideally include:

Frontend:
TypeScript

Backend:
Python or Go

Tests:
multiple test files

A database-related module

A service with several dependents

Then create intentional PRs:

PR 1:
Low-risk documentation change

PR 2:
Medium-risk business logic change

PR 3:
High-risk core service change

This allows the final demo to show that the analyzer produces different analyses.

Do NOT depend on an external repository being available for the demo.

==================================================
36. EVALUATION
==================================================

Create a simple evaluation methodology.

For a set of manually labeled PRs, evaluate:

1. Changed-symbol detection
2. Impact detection
3. Test relationship detection
4. Risk classification
5. Quality of test recommendations

Do not claim scientific accuracy without a real benchmark.

Display simple metrics such as:

- impact precision
- impact recall
- risk classification agreement

only if actually measured.

==================================================
37. DOCUMENTATION
==================================================

README must contain:

1. Project overview
2. Problem statement
3. Architecture
4. System flow
5. Language-agnostic design
6. Why Tree-sitter
7. Why deterministic analysis + LLM
8. Tech stack
9. Setup instructions
10. Environment variables
11. Docker instructions
12. API documentation
13. Example analysis
14. Limitations
15. Future improvements

Include architecture diagrams.

Also create:

docs/
├── architecture.md
├── analysis-pipeline.md
├── language-adapters.md
├── api.md
└── evaluation.md

==================================================
38. FUTURE EXTENSIONS
==================================================

Document but do not necessarily implement:

- GitHub App authentication
- automatic PR comments
- GitLab support
- Bitbucket support
- more languages
- organization-specific risk rules
- historical PR learning
- CI/CD integration
- test generation
- automatic patch suggestions
- code review assistant
- security vulnerability detection
- architectural rule checking

==================================================
39. DEVELOPMENT STRATEGY
==================================================

Before writing large amounts of code:

1. Inspect the environment.
2. Decide exact dependency versions.
3. Create project structure.
4. Create architecture documentation.
5. Implement backend skeleton.
6. Implement repository ingestion.
7. Implement language detection.
8. Implement Tree-sitter abstraction.
9. Implement common code representation.
10. Implement dependency graph.
11. Implement impact analysis.
12. Implement test analysis.
13. Implement LLM service.
14. Implement persistence.
15. Implement frontend.
16. Integrate everything.
17. Add tests.
18. Add Docker.
19. Run end-to-end demo.
20. Fix issues.
21. Polish README.

After every major component, run tests before proceeding.

Do not build everything and only test at the end.

==================================================
40. IMPORTANT ENGINEERING PRINCIPLES
==================================================

Follow these principles throughout implementation:

1. Evidence over hallucination.
2. Deterministic analysis before LLM reasoning.
3. Language-specific parsing isolated behind interfaces.
4. Small services with clear responsibilities.
5. Async processing for expensive analysis.
6. Idempotent analysis jobs.
7. Strong typing.
8. Structured LLM output.
9. Secrets never exposed to frontend.
10. Never execute untrusted repository code.
11. Graceful failure.
12. Good developer experience.
13. Simple architecture over unnecessary infrastructure.

==================================================
41. FINAL SUCCESS CRITERIA
==================================================

The project is considered complete when I can run:

docker compose up

Then:

1. Open the frontend.
2. Configure a GitHub repository.
3. Select a PR.
4. Click Analyze.
5. See analysis progress.
6. See changed files.
7. See detected changed symbols.
8. See affected components.
9. See dependency graph.
10. See related tests.
11. See risk level.
12. See evidence-backed risk factors.
13. See recommended tests.
14. See source locations/evidence for important claims.

The system should work on repositories containing multiple supported languages.

The system should NOT require manually telling it which language the repository uses.

==================================================
42. IMPLEMENTATION INSTRUCTION
==================================================

Start by creating a concise implementation plan and architecture decision record.

Then create the project skeleton.

Do not ask unnecessary questions.

If a technical choice is ambiguous, prefer the simplest solution that satisfies the requirements.

Before introducing a new dependency or infrastructure component, ask:

"Is this actually necessary for the one-week MVP?"

If not, don't add it.

Build incrementally and keep the application runnable throughout development.

At the end, provide:

1. What was implemented
2. Architecture summary
3. How to run it
4. Environment variables required
5. Supported languages
6. Known limitations
7. Tests run
8. Example demo flow
9. Future improvements

Most importantly:

Build a REAL working developer tool, not a mockup.

The final project should demonstrate strong software engineering fundamentals AND meaningful GenAI integration.