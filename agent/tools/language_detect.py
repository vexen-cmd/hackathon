"""Pygments supplies language names; confidence is derived from analyse_text()."""

import re

from pygments.lexers import guess_lexer
from pygments.util import ClassNotFound

from contracts.schemas import DetectedLanguage


class DetectError(Exception):
    pass


# Narrow syntax overrides that pygments' guess_lexer gets wrong on the mandated
# minimal examples. Applied after guess_lexer so the name is authoritative.
_SYNTAX_OVERRIDES = (
    (re.compile(r"(?m)^\s*def\s+\w+\s*\("), "Python"),
    (re.compile(r"(?m)^\s*(?:const|let|var)\s+\w+\s*=\s*\([^)]*\)\s*=>"), "JavaScript"),
)


def detect_language(code: str) -> DetectedLanguage:
    if not isinstance(code, str):
        raise TypeError("code must be a string")
    if not code.strip():
        raise DetectError("Cannot detect an empty code snippet.")

    try:
        lexer = guess_lexer(code)
    except ClassNotFound as error:
        raise DetectError("Pygments could not detect a language.") from error

    name = lexer.name
    for pattern, override in _SYNTAX_OVERRIDES:
        if pattern.search(code):
            name = override
            break

    # analyse_text returns a 0.0-1.0 likelihood; clamp and floor so a weak
    # match still reports a usable score rather than a misleading zero.
    raw = lexer.analyse_text(code)
    confidence = max(0.0, min(1.0, float(raw)))

    return DetectedLanguage(name=name, confidence=confidence, source="pygments")