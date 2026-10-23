from typing import Protocol


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
