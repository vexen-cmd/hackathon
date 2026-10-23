# Snippet Studio

A local, safety-first code documentation workspace. Submit a code snippet, review an AI-generated `README.md`, and deliver it only after the deterministic harness verifies a human approval bound to the exact output.

## What it does

- Uses Ollama and Qwen locally to explain submitted code.
- Generates a concise Markdown `README.md` with an overview, code-structure tree, and usage only where supported by the snippet.
- Requires human approval before delivery.
- Rejects stale approvals when content changes after the output hash is created.
- Treats all submitted code, comments, and strings as untrusted data.
- Records workflow events and evidence in a tamper-evident chain.

## Architecture

```text
React / Vite dashboard
        |
        v
Express server (port 8000) ----> FastAPI harness (port 8001)
                                        |
                                        v
                                  Ollama / Qwen
```

The Python harness owns the workflow state machine, evidence ledger, approval validation, output hashing, and event-chain verification. The model can propose text only; it cannot approve or deliver it.

## Requirements

- Python 3.12+
- Node.js 20+
- Ollama
- Qwen model: `qwen2.5-coder:1.5b`

```powershell
ollama pull qwen2.5-coder:1.5b
```

## Install

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

npm ci
npm --prefix frontend ci
```

## Run locally

Build the frontend, then start the combined Express server. It starts the Python harness automatically.

```powershell
npm run build
npm start
```

Open http://127.0.0.1:8000.

For frontend development with hot reload, run this in a second terminal:

```powershell
npm run dev:frontend
```

Open http://127.0.0.1:5173. Vite proxies API requests to the backend.

### Alternative FastAPI-only launch

The project also includes a PowerShell launcher that serves the built frontend directly from FastAPI:

```powershell
.\scripts\start_review_server.ps1
```

Open http://127.0.0.1:8000.

## Workflow

1. Paste or select a code snippet in the dashboard.
2. Select **Analyze Snippet**.
3. Review the explanation and generated `README.md`.
4. Select **Approve & Cryptographically Sign** to deliver the exact hashed output, or reject it.

The dashboard includes session history, a code editor, evidence records, the pipeline state, and an approval gateway.

## Tests

```powershell
$env:PYTHONPATH = "."
.\.venv\Scripts\python.exe -m pytest tests/unit tests/scenarios -q

npm run build
```

The test suite covers state transitions, approval receipts, hash binding, event-chain integrity, language detection, and prompt-injection scenarios.

## Project structure

```text
agent/harness/     Deterministic workflow, approval, evidence, and event-chain logic
agent/tools/       Ollama, Gemini, and language-detection tool boundaries
apps/api/          FastAPI adapter and API endpoints
backend/           Express server that proxies to the FastAPI harness
contracts/         Pydantic workflow schemas
frontend/          React + Vite dashboard
scripts/           Local launch and verification scripts
tests/             Unit and adversarial workflow tests
```

## Safety model

Submitted snippets are never executed. Generated text remains a proposal until a reviewer approves the canonical output hash. Any changed explanation or README invalidates the approval and must be reviewed again.
