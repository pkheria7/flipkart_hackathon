"""
LLM explainer using Groq LLaMA.

Generates plain-English explanations of why a hotspot is prioritized,
using the numeric ROI/LCLE/BCI/persistence/recurrence data as context.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from groq import Groq

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CACHE_FILE = PROJECT_ROOT / "data" / "outputs" / "llm_cache.json"

DEFAULT_MODEL = "llama-3.3-70b-versatile"


def _load_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}


def _save_cache(cache: dict) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def _build_prompt(cluster_data: dict) -> str:
    return (
        "You are a traffic enforcement analyst for Bangalore Traffic Police. "
        "Explain in 1-2 simple sentences why this parking hotspot is a high priority for patrol today. "
        "Use the provided metrics but write in plain English that a police officer can understand.\n\n"
        f"Cluster ID: {cluster_data['cluster_id']}\n"
        f"Road class: {cluster_data['road_class']}\n"
        f"Road width: {cluster_data['road_width_m']:.1f} meters\n"
        f"Total violations: {cluster_data['violation_count']}\n"
        f"LCLE (lane blockage): {cluster_data['lcle_pct']:.1f}%\n"
        f"BCI (traffic criticality): {cluster_data['bci']:.4f}\n"
        f"Persistence (violations per peak hour): {cluster_data['persistence']:.2f}\n"
        f"Recurrence (weeks active): {cluster_data['recurrence']:.2f}\n"
        f"ROI score: {cluster_data['roi_score']:.1f}/100\n"
        f"Classification: {cluster_data['classification']}\n"
        f"Peak window: {cluster_data['peak_window']}\n\n"
        "Explanation:"
    )


def explain_hotspot(cluster_data: dict, api_key: str | None = None) -> str:
    """
    Generate a plain-English explanation for a hotspot.
    Uses a local cache to avoid repeated API calls.
    """
    cache = _load_cache()
    cache_key = f"explain:{cluster_data['cluster_id']}"
    if cache_key in cache:
        return cache[cache_key]

    key = api_key or os.getenv("GROQ_API_KEY")
    if not key:
        # Fallback template explanation
        explanation = (
            f"{cluster_data['cluster_id']} is a {cluster_data['classification'].lower()} hotspot with "
            f"{cluster_data['violation_count']} violations. It scores {cluster_data['roi_score']:.1f} on ROI "
            f"due to {cluster_data['lcle_pct']:.1f}% lane blockage and peak activity during {cluster_data['peak_window']}."
        )
        return explanation

    client = Groq(api_key=key)
    prompt = _build_prompt(cluster_data)

    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful traffic enforcement analyst."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            max_tokens=120,
        )
        explanation = response.choices[0].message.content.strip()
    except Exception as exc:
        explanation = (
            f"{cluster_data['cluster_id']} is a {cluster_data['classification'].lower()} hotspot with "
            f"{cluster_data['violation_count']} violations and an ROI score of {cluster_data['roi_score']:.1f}. "
            f"(LLM fallback: {exc})"
        )

    cache[cache_key] = explanation
    _save_cache(cache)
    return explanation


if __name__ == "__main__":
    sample = {
        "cluster_id": "C_298",
        "road_class": "trunk",
        "road_width_m": 10.5,
        "violation_count": 1409,
        "lcle_pct": 50.9,
        "bci": 0.691,
        "persistence": 4.5,
        "recurrence": 0.85,
        "roi_score": 87.2,
        "classification": "STRUCTURAL",
        "peak_window": "17:00-19:00",
    }
    print(explain_hotspot(sample))
