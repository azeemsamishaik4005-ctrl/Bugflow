# DefectX — Intelligent Software Defect Tracking System with Resolution Assistance

> **Milestone 4 Complete Full-Stack Release**  
> An enterprise-grade, intelligent software defect tracking platform featuring defect dependency mapping, unsupervised AI pattern detection, deterministic regression risk detection, semantic issue retrieval, grounded AI resolution guidance, and automated quality telemetry.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Key Capabilities & Milestone 4 Highlights](#-key-capabilities--milestone-4-highlights)
3. [System Architecture](#-system-architecture)
4. [Database Schema & Data Model](#-database-schema--data-model)
5. [Defect Lifecycle & SLA Engine](#-defect-lifecycle--sla-engine)
6. [API Reference & Swagger Documentation](#-api-reference--swagger-documentation)
7. [Installation & Setup Guide](#-installation--setup-guide)
8. [Automated Testing & Verification](#-automated-testing--verification)
9. [Branding & Design Guidelines](#-branding--design-guidelines)
10. [License & Acknowledgments](#-license--acknowledgments)

---

## 🚀 Project Overview

**DefectX** is an intelligent software defect tracking system engineered to bridge the gap between reporting defects and resolving them. While legacy issue trackers function as passive issue logs, DefectX incorporates analytical intelligence and automated telemetry to assist engineering teams at every stage of the defect lifecycle:

* **Triage & Classification:** Automatic severity detection, component tagging, and SLA deadline estimation.
* **Resolution Assistance:** Root-cause investigation suggestions, past historical resolution matching, and developer-verified resolution documentation.
* **Topological Dependency Mapping:** Multi-hop defect relationship tracking with directional graph visualization (`Depends On`, `Blocks`, `Related To`, `Caused By`).
* **Predictive Quality Telemetry:** Early warning surge detection, 14-day defect trajectory explanations, and unsupervised recurring defect pattern clustering.

---

## ✨ Key Capabilities & Milestone 4 Highlights

### 1. Defect Dependency Mapping
* **Four Typed Relationships:** `Depends On`, `Blocks`, `Related To`, and `Caused By`.
* **Bidirectional Association:** Linking Defect A to Defect B records reciprocal relationships in project activity history.
* **Interactive SVG Topology Graph:** Dynamic visual graph rendering nodes and directional arrows with node click navigation, hover highlights, and real-time dependency removal.
* **Cycle & Self-Dependency Prevention:** Robust validation middleware rejecting self-linking and duplicate relations.

### 2. AI Defect Pattern Detection
* **Unsupervised Multi-Attribute Clustering:** Groups defects across components, triggers, error categories, and failure signatures.
* **Empirical Metrics:** Computes recurrence counts, average resolution duration in days/hours, and lists all linked defect identifiers (`DEF-X`).
* **Dynamic Recurrence Benchmarks:** Automatically surfaces recurring structural flaws to prevent recurrent regressions.

### 3. Deterministic Regression Risk Detection
* **Multi-Factor Risk Calculation:** Analyzes historical defect rates, component churn, reopen frequency, and severity ratios to output `Low`, `Medium`, or `High` risk scores (0–100%).
* **Actionable Verification Checklist:** Recommends specific automated test strategies, boundary checks, and regression test suites tailored to the affected module.
* **Engineering Disclaimer:** Clearly discloses analytical risk indicators to ensure ethical, grounded guidance without unsubstantiated claims.

### 4. Defect Cluster / Issue Map
* **Hierarchical Tree Decomposition:** Categorizes defects hierarchically: `Category` ➔ `Component` ➔ `Topics`.
* **Clickable Defect Pills:** Directly navigates into defect details by selecting any `DEF-X` pill from the cluster map.
* **Backlog Hotspot Visualization:** Enables engineering leads to immediately identify subsystem bottlenecks at a glance.

### 5. Grounded Defect Trend Explanation
* **14-Day Trajectory Analysis:** Compares defect creation vs. resolution volume across rolling 14-day and 28-day windows.
* **Automated Narrative Synthesis:** Generates human-readable explanations identifying velocity shifts, top driver components, and resolution progression.
* **Trajectory Status Indicators:** Visual status badges indicating whether quality trajectories are `Improving`, `Stable`, or `Degrading`.

### 6. Defect Health Indicator & SLA Telemetry
* **Deterministic SLA Calculation:**
  * **Critical (P1):** 48-hour resolution SLA.
  * **High (P2):** 120-hour resolution SLA.
  * **Medium (P3):** 240-hour resolution SLA.
  * **Low (P4):** 720-hour resolution SLA.
* **Four Health States:**
  * 🟢 `Healthy / On Track` — Defect is progressing normally within SLA boundaries.
  * 🟡 `Attention Needed` — Reopened defect or unassigned blocker approaching threshold.
  * 🟠 `At Risk` — Aging high-priority defect exceeding median turnaround time.
  * 🔴 `Critical Overdue` — P1 defect breaching SLA thresholds without resolution.

### 7. AI Semantic Defect Search
* **NLP TF-IDF Search Engine:** Matches natural language queries based on conceptual meaning even when exact keywords differ.
* **Domain Synonym Graph:** Built-in software engineering synonym network (`auth` ↔ `jwt` ↔ `session`, `payment` ↔ `stripe` ↔ `billing`, `crash` ↔ `exception` ↔ `error`).
* **Cosine Similarity Scoring:** Returns ranked defects with relevance scores (0.00 – 1.00) and matched query tokens.

### 8. Context-Aware Grounded AI Assistant
* **Contextual Active Defect Awareness:** Automatically binds the currently inspected defect (`activeIssue`) to conversational prompts.
* **Quick Prompt Chips:** One-click shortcuts for "Explain DEF-X", "Check regression risk for DEF-X", "Defect trends", and "Recurring defect patterns".
* **Real Database Grounding:** Queries live database records before generating responses; falls back to an internal deterministic synthesizer if third-party AI APIs are unreachable.

---

## 🏗️ System Architecture

DefectX is built on a decoupled full-stack architecture designed for high availability, fast response times, and resilience:

```
DefectX Platform Architecture
│
├── Frontend (Client)
│   ├── React 18 + Vite SPA
│   ├── Lucide React Icons
│   ├── Vanilla CSS Theme System (Glassmorphic Dark UI)
│   ├── Interactive SVG Dependency Graph Visualizer
│   └── Views: Dashboard, Issues (List & Kanban), Analytics, Floating AI Assistant
│
├── Backend API (Server)
│   ├── Express.js REST API
│   ├── JWT Authentication & Role-Based Access Control (Admin, QA, Developer)
│   ├── Dual-Engine Storage Layer:
│   │   ├── PostgreSQL via Prisma ORM / pg pool
│   │   └── Zero-Config Embedded Engine (Local In-Memory/JSON Storage)
│   ├── Deterministic Intelligence Engines (TF-IDF, SLA, Patterns, Risk)
│   ├── Swagger / OpenAPI 3.0 Interactive Documentation (/api-docs)
│   └── AI Assistant Synthesizer (Anthropic Claude / Google Gemini / Local Engine)
│
└── CI/CD & Automated Testing
    ├── GitHub Actions Workflow (.github/workflows/ci.yml)
    ├── Backend Unit & Integration Tests (tests/api.test.js — 31 tests)
    └── Assistant Intelligence Test Suite (tests/assistant.test.js — 8 tests)
```

---

## 🗄️ Database Schema & Data Model

DefectX supports both PostgreSQL (via Prisma ORM / direct driver) and an embedded engine. The data model contains 7 primary relational tables:

```sql
-- Users & Roles
users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(100) DEFAULT 'Developer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects
projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  key VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sprints
sprints (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Active'
);

-- Defects / Issues
issues (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id),
  sprint_id INT REFERENCES sprints(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'Bug',
  status VARCHAR(50) DEFAULT 'Open',
  priority VARCHAR(50) DEFAULT 'P2',
  severity VARCHAR(50) DEFAULT 'Medium',
  component VARCHAR(100) DEFAULT 'Frontend UI',
  category VARCHAR(100) DEFAULT 'General',
  environment VARCHAR(100) DEFAULT 'Production',
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  reporter_id INT REFERENCES users(id),
  assignee_id INT REFERENCES users(id),
  root_cause TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Defect Dependency Mapping (Milestone 4)
defect_dependencies (
  id SERIAL PRIMARY KEY,
  source_issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
  target_issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL, -- 'Depends On' | 'Blocks' | 'Related To' | 'Caused By'
  notes TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments & Collaboration
comments (
  id SERIAL PRIMARY KEY,
  issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Trail & Activity History
activity_history (
  id SERIAL PRIMARY KEY,
  issue_id INT REFERENCES issues(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  old_state TEXT,
  new_state TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔄 Defect Lifecycle & SLA Engine

DefectX enforces strict state transition integrity to prevent invalid workflow progressions:

```
[Open] ──(Triage / Assign)──> [In Progress]
  ▲                                │
  │                         (Fix Implemented)
(Reopened)                         ▼
  │                           [In Review]
  │                                │
  │                         (Review Passed)
  │                                ▼
  └──── (Verification Failed) ── [Retest/Verify]
                                   │
                            (Verification Passed)
                                   ▼
                              [Resolved]
                                   │
                            (Sprint Signoff)
                                   ▼
                               [Closed]
```

### SLA Priority & Resolution Windows

| Severity / Priority | Resolution Target (SLA) | Auto-Escalation Threshold | Health Status Trigger |
| :--- | :--- | :--- | :--- |
| **Critical / P1** | 48 Hours (2 Days) | > 48 Hours Unresolved | 🔴 `Critical Overdue` |
| **High / P2** | 120 Hours (5 Days) | > 120 Hours Unresolved | 🟠 `At Risk` |
| **Medium / P3** | 240 Hours (10 Days) | > 240 Hours Unresolved | 🟡 `Attention Needed` |
| **Low / P4** | 720 Hours (30 Days) | > 720 Hours Unresolved | 🟢 `Healthy / On Track` |

---

## 📡 API Reference & Swagger Documentation

DefectX exposes a comprehensive OpenAPI 3.0 REST API. Interactive Swagger documentation is accessible at:
👉 `http://localhost:5000/api-docs/`

### 1. Authentication (`/api/auth`)
* `POST /api/auth/register` — Create developer account, return JWT session.
* `POST /api/auth/login` — Authenticate user with email and password.
* `GET /api/auth/me` — Return current authenticated profile.

### 2. Defect & Issue Management (`/api/issues`)
* `GET /api/issues` — Query defects with filters (severity, component, health, search) and SLA indicators.
* `POST /api/issues` — Report a new defect with validation.
* `GET /api/issues/:id` — Retrieve defect details, history, comments, and health indicator.
* `PUT /api/issues/:id` — Update defect attributes and progress status lifecycle.
* `POST /api/issues/:id/resolve` — Mark resolved with root-cause and resolution notes.

### 3. Defect Dependencies (`/api/issues/:id/dependencies`)
* `GET /api/issues/:id/dependencies` — Retrieve bidirectional dependencies for defect.
* `POST /api/issues/:id/dependencies` — Create typed dependency (`Depends On`, `Blocks`, `Related To`, `Caused By`).
* `DELETE /api/issues/:id/dependencies/:depId` — Delete dependency link.
* `GET /api/issues/:id/dependency-graph` — Retrieve visual nodes and edges topology graph.

### 4. AI Resolution Intelligence (`/api/ai`)
* `GET /api/ai/patterns` — Unsupervised recurring defect patterns with duration and linked `DEF-X` IDs.
* `GET /api/ai/regression-risk/:issueId` — Deterministic regression risk score and verification checklist.
* `POST /api/ai/semantic-search` — TF-IDF NLP semantic retrieval with synonym expansion.
* `POST /api/ai/summarize` — Generate concise defect summary.
* `POST /api/ai/resolution-recommendation` — Prescribe step-by-step resolution steps.
* `POST /api/ai/historical-resolutions` — Match similar resolved historical defects.
* `POST /api/ai/investigate-root-cause` — Prioritized root-cause investigation checklist.
* `POST /api/ai/verify-resolution` — Validate developer fix notes against reported symptoms.
* `POST /api/ai/assistant` — Context-aware grounded AI assistant chat.

### 5. Telemetry & Analytics (`/api/analytics`)
* `GET /api/analytics` — Complete dashboard telemetry, severity breakdown, and workload.
* `GET /api/analytics/trend-explanation` — 14-day creation vs resolution trajectory narrative.
* `GET /api/analytics/early-warning` — Surge detection and critical defect backlog warnings.
* `GET /api/analytics/insight-of-the-day` — Grounded daily quality metric and analysis.
* `GET /api/analytics/defect-clusters` — Hierarchical Category ➔ Component ➔ Topic cluster map.
* `GET /api/analytics/sprint-health/:sprintId` — Sprint health score (0–100) and delivery pacing.

---

## 🛠️ Installation & Setup Guide

### Prerequisites
* **Node.js:** v18.0.0 or higher
* **npm:** v9.0.0 or higher
* **PostgreSQL:** Optional (DefectX automatically uses the built-in storage engine if PostgreSQL is not configured).

### 1. Clone & Configure Server
```bash
cd server
npm install

# Configure environment variables
cp .env.example .env
```

**Environment Variables (`server/.env`):**
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=defectx_secure_jwt_token_secret_production_ready
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/defectx_db

# Optional AI API keys (system gracefully uses internal grounded engine if omitted)
ANTHROPIC_API_KEY=your_anthropic_key_here
GEMINI_API_KEY=your_gemini_key_here
```

### 2. Start the Backend Server
```bash
# In server directory:
npm run dev
# Server listening on http://localhost:5000
# OpenAPI / Swagger UI at http://localhost:5000/api-docs
```

### 3. Start the Frontend Application
```bash
# In client directory:
npm install
npm run dev
# Client running on http://localhost:5173
```

### 4. Build for Production
```bash
# Build frontend assets:
cd client
npm run build

# Start production server (serves client from client/dist):
cd ../server
npm start
```

---

## 🧪 Automated Testing & Verification

DefectX includes a comprehensive automated test suite testing all endpoints, authentication flows, SLA metrics, dependency graphing, AI intelligence, and telemetry:

```bash
cd server
npm test
```

### Test Suite Execution Output
```
> defectx-server@1.0.0 test
> node tests/api.test.js && node tests/assistant.test.js

🧪 Starting DefectX API & Resolution Intelligence Test Suite...
  ✅ PASS: GET /api/health returns 200 OK
  ✅ PASS: POST /api/auth/register creates a new developer user
  ✅ PASS: GET /api/auth/me returns authenticated profile with Bearer token
  ✅ PASS: GET /api/users returns team member list
  ✅ PASS: GET /api/projects lists projects
  ✅ PASS: POST /api/issues creates a defect
  ✅ PASS: PUT /api/issues/:id transitions status to In Progress and assigns developer
  ✅ PASS: POST /api/issues/:id/resolve resolves defect with root cause and resolution notes
  ✅ PASS: POST /api/ai/summarize generates concise defect summary
  ✅ PASS: POST /api/ai/resolution-recommendation generates actionable developer guidance
  ✅ PASS: POST /api/ai/historical-resolutions retrieves similar resolved defects with similarity scores
  ✅ PASS: POST /api/ai/investigate-root-cause returns prioritized investigation checklist
  ✅ PASS: POST /api/ai/verify-resolution validates developer resolution notes
  ✅ PASS: GET /api/analytics returns complete telemetry and KPI metrics
  ✅ PASS: GET /api-docs serves Swagger UI documentation
  ✅ PASS: GET /api/issues includes health_indicator with SLA metrics
  ✅ PASS: POST /api/issues creates a secondary defect for dependency linking
  ✅ PASS: POST /api/issues/:id/dependencies creates a dependency relation
  ✅ PASS: POST /api/issues/:id/dependencies validates and rejects self-dependency with 400
  ✅ PASS: POST /api/issues/:id/dependencies validates and rejects invalid relationship type with 400
  ✅ PASS: GET /api/issues/:id/dependencies returns bidirectional dependencies
  ✅ PASS: GET /api/issues/:id/dependency-graph returns nodes and edges graph structure
  ✅ PASS: DELETE /api/issues/:id/dependencies/:depId deletes dependency
  ✅ PASS: GET /api/ai/patterns returns recurring defect patterns
  ✅ PASS: GET /api/ai/regression-risk/:issueId computes regression risk metrics
  ✅ PASS: POST /api/ai/semantic-search performs NLP TF-IDF similarity query
  ✅ PASS: GET /api/analytics/trend-explanation returns grounded trajectory explanation
  ✅ PASS: GET /api/analytics/early-warning evaluates project risk telemetry
  ✅ PASS: GET /api/analytics/insight-of-the-day returns dynamic grounded insight
  ✅ PASS: GET /api/analytics/defect-clusters returns hierarchical issue map
  ✅ PASS: GET /api/analytics/sprint-health/:sprintId returns sprint health telemetry
=============================================
📊 Test Summary: 31 Passed, 0 Failed
=============================================

🧪 Starting DefectX AI Assistant Pipeline Test Suite...
  ✅ PASS: POST /api/ai/assistant rejects unauthenticated requests with 401
  ✅ PASS: POST /api/ai/assistant validates empty message with 400
  ✅ PASS: POST /api/ai/assistant identifies CRITICAL_BUGS intent and provides grounded answer
  ✅ PASS: POST /api/ai/assistant identifies SYSTEM_METRICS intent and provides quality telemetry
  ✅ PASS: POST /api/ai/assistant performs semantic retrieval on authentication defects
  ✅ PASS: POST /api/ai/assistant retrieves historical resolution for past defects
  ✅ PASS: POST /api/ai/assistant returns structured details when asked about #1
  ✅ PASS: POST /api/ai/chat alias functions as expected
=============================================
🏁 Test Suite Complete: 8 Passed, 0 Failed
=============================================
```

---

## 🎨 Branding & Design Guidelines

* **Official Product Name:** **DefectX**
* **Subtitle:** Intelligent Software Defect Tracking System with Resolution Assistance
* **Identifier Standard:** All defect numbers are strictly formatted as `DEF-${id}` (e.g. `DEF-1`, `DEF-4`).
* **Design Philosophy:** Dark-mode glassmorphic interface utilizing modern CSS design tokens, glowing border gradients, subtle micro-animations, accessible color-coded badges, and responsive layouts.

---

## 📄 License & Acknowledgments

* **Project:** DefectX Software Tracking & Resolution Intelligence
* **Release:** Milestone 4 Final Implementation
* **Team:** DefectX Engineering Team
