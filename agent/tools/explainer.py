import re
from typing import Protocol


def clean_documentation(documentation: str) -> str:
    """Keep delivered output focused on snippet documentation, not project trees."""
    section_pattern = re.compile(
        r"(?ims)^\s{0,3}#{1,6}\s*(?:code\s+structure|project\s+structure)\s*\n"
        r".*?(?=^\s{0,3}#{1,6}\s+|\Z)"
    )
    return section_pattern.sub("", documentation).strip()


def include_explanation(documentation: str, explanation: str) -> str:
    """Make the delivered Markdown self-contained by including the explanation."""
    explanation_section = re.compile(
        r"(?ims)^\s{0,3}#{1,6}\s*explanation\s*:?[ \t]*\n"
        r".*?(?=^\s{0,3}#{1,6}\s+|\Z)"
    )
    without_existing = explanation_section.sub("", documentation).strip()
    return f"## Explanation\n\n{explanation.strip()}\n\n{without_existing}".strip()


class Explainer(Protocol):
    def explain_and_document(self, code: str, language: str) -> tuple[str, str, list[str]]:
        ...


class StubExplainer:
    def explain_and_document(self, code: str, language: str) -> tuple[str, str, list[str]]:
        return (
            f"Stub explanation for {language} snippet.",
            f"# {language} Snippet\n\n## Overview\n\nDocumentation stub.\n\n## Code Structure\n\n```text\nproject/\n└── snippet\n```",
            [language.lower(), "snippet"],
        )


class ExplainError(Exception):
    pass


# Real implementation lives in gemini_explainer.py. Do not import it
# here; it must be imported explicitly by the wiring layer.
