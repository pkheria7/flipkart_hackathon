"""
Kannada translator using Groq LLaMA.

Translates English hotspot explanations into Kannada for local officers and drivers.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CACHE_FILE   = PROJECT_ROOT / "data" / "outputs" / "llm_cache.json"

DEFAULT_MODEL = "llama-3.3-70b-versatile"

try:
    from groq import Groq as _Groq
    _GROQ_AVAILABLE = True
except ImportError:
    _Groq = None  # type: ignore[assignment,misc]
    _GROQ_AVAILABLE = False


def _stable_key(text: str) -> str:
    """Return a stable SHA-256-based cache key — safe across Python sessions."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def translate_to_kannada(text: str, api_key: str | None = None) -> str:
    """
    Translate an English explanation into Kannada.

    Uses a SHA-256-keyed local cache to avoid repeated API calls.
    Falls back to a labelled placeholder if GROQ_API_KEY is not set or groq is not installed.
    """
    cache = _load_cache()

    # Stable key (replaces old hash()-based key which was not cross-session-safe)
    cache_key = f"kannada_v2:{_stable_key(text)}"
    if cache_key in cache:
        return cache[cache_key]

    key = api_key or os.getenv("GROQ_API_KEY")
    if not key or not _GROQ_AVAILABLE:
        if not _GROQ_AVAILABLE:
            return f"[Kannada translation unavailable — install groq: pip install groq] {text}"
        return f"[Kannada translation unavailable — set GROQ_API_KEY] {text}"

    client = _Groq(api_key=key)
    prompt = (
        "Translate the following English text into Kannada (ಕನ್ನಡ). "
        "Keep it simple and natural for a Bangalore traffic police officer or driver to understand. "
        "Only return the Kannada translation, nothing else.\n\n"
        f"English: {text}\n\n"
        "Kannada:"
    )

    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": "You are a Kannada translator."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=200,
        )
        translation = response.choices[0].message.content.strip()
    except Exception as exc:
        translation = f"[Kannada translation failed: {exc}]"

    cache[cache_key] = translation
    _save_cache(cache)
    return translation


if __name__ == "__main__":
    sample = (
        "C_298 is a structural hotspot with 1,409 violations. It scores 87.2 on ROI "
        "due to 50.9% lane blockage and peak activity during 17:00-19:00."
    )
    print(translate_to_kannada(sample))
