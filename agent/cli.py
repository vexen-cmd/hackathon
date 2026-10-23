"""Command-line entry point: file/stdin -> Markdown documentation.

Satisfies the "web-based OR command-line interface" option in the brief and
gives an offline path that needs no Ollama/Gemini backend (uses the stub
explainer unless EXPLAINER/OLLAMA_HOST/GEMINI_API_KEY are set).

Usage:
    python -m agent.cli snippet.py
    python -m agent.cli --stdin < snippet.py
    python -m agent.cli snippet.py --approve reviewer-1
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from agent.harness.approval import apply_edits, make_approval_receipt
from agent.harness.evidence import EvidenceLedger
from agent.harness.orchestrator import Orchestrator
from agent.harness.state_machine import StateMachine
from agent.tools.explainer import StubExplainer
from agent.tools.gemini_explainer import GeminiExplainer
from agent.tools.language_detect import detect_language
from agent.tools.local_explainer import LocalExplainer
from contracts.schemas import Approval, CodeSnippet


def _build_explainer() -> object:
    backend = os.environ.get("EXPLAINER", "stub").strip().lower()
    if backend == "ollama":
        return LocalExplainer()
    if backend == "gemini":
        return GeminiExplainer()
    return StubExplainer()


def run(source: str, code: str, *, approve: str | None, edit_explanation: str | None, edit_documentation: str | None) -> str:
    request_id = f"cli-{abs(hash((source, code))) & 0xFFFFFFFF:08x}"
    orchestrator = Orchestrator(
        sm=StateMachine(request_id),
        ledger=EvidenceLedger(),
        detect_language_fn=detect_language,
        explainer=_build_explainer(),
    )
    snippet = CodeSnippet(code=code, source_id=source, submitted_at=datetime.now(timezone.utc))
    proposal = orchestrator.run_analysis(snippet)
    if proposal is None:
        raise SystemExit("Analysis failed: snippet is empty or too large.")

    if approve:
        approval = Approval(
            proposal_hash=proposal.output_hash,
            approver_id=approve,
            approved_at=datetime.now(timezone.utc),
            decision="approve",
            edited_explanation=edit_explanation,
            edited_documentation=edit_documentation,
        )
        if edit_explanation is not None or edit_documentation is not None:
            proposal = apply_edits(proposal, approval)
            approval = approval.model_copy(update={"proposal_hash": proposal.output_hash})
        approval = approval.model_copy(update={"approval_receipt_hash": make_approval_receipt(approval)})
        orchestrator.apply_review(proposal, approval)
        result = orchestrator.format_output(proposal, approval)
        return result.formatted_markdown or ""

    return proposal.documentation


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Explain and document a code snippet from the command line.")
    parser.add_argument("source", nargs="?", help="Path to a source file (or '-' / omitted for stdin).")
    parser.add_argument("--stdin", action="store_true", help="Read the snippet from standard input.")
    parser.add_argument("--approve", metavar="APPROVER", help="Approve and deliver the output immediately.")
    parser.add_argument("--edit-explanation", default=None, help="Edited explanation (requires --approve).")
    parser.add_argument("--edit-documentation", default=None, help="Edited documentation (requires --approve).")
    args = parser.parse_args(argv)

    if args.stdin or args.source in (None, "-"):
        code = sys.stdin.read()
        source = "stdin"
    else:
        path = Path(args.source)
        if not path.is_file():
            print(f"error: file not found: {args.source}", file=sys.stderr)
            return 2
        code = path.read_text(encoding="utf-8")
        source = args.source

    try:
        output = run(source, code, approve=args.approve, edit_explanation=args.edit_explanation, edit_documentation=args.edit_documentation)
    except Exception as error:  # noqa: BLE001 - surface any harness failure to the CLI user
        print(f"error: {error}", file=sys.stderr)
        return 1

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())