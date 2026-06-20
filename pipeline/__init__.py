"""
pipeline package

Contains the modular data-processing pipeline for the Parking Enforcement
Intelligence Engine. Each numbered stage reads from data/processed/ or
data/outputs/ and writes the next artifact in the chain.

Run order:
    01_clean.py -> 02_cluster.py -> 03_jurisdiction.py -> 04_enrich_osm.py
    -> 05_score.py -> 06_optimize_vrp.py -> 07_validate.py
"""

# This file intentionally contains no executable code.
# It marks `pipeline/` as a Python package and documents the stage order.
