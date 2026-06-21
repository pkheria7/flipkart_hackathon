# Week 1 vs Week 2 Demo Report

> This report compares two simulated weeks. Week 1 shows the agent's initial proactive patrols and feedback collection. Week 2 shows the simulated outcome after applying enforcement learnings.

## Key metrics

| Metric | Week 1 | Week 2 | Change |
|--------|--------|--------|--------|
| Total violations | 257,752 | 223,371 | -34,381 (-13.3%) |
| STRUCTURAL clusters | 243 | 309 | +66 |
| RESPONSIVE clusters | 631 | 583 | -48 |
| Avg ROI of hotspots | 50.05 | 50.05 | -0.00 |
| Counterfactual violations (no intervention) | — | 270,639 | — |
| Prevented violations (simulated) | — | 47,268 | — |

## Interpretation

- Week 1 establishes the baseline and generates officer/citizen feedback.
- Recurred hotspots are escalated to STRUCTURAL in Week 2.
- Resolved hotspots show reduced violation counts in Week 2.
- The counterfactual line estimates what Week 2 might have looked like without the agent's intervention.

## Limitations

- This is a synthetic simulation based on historical patterns.
- It does not prove real-world causal impact.
- Live deployment requires a real data feed from BTP.

## Generated outputs

- Week 1 synthetic scored hotspots: `/Users/pkheria7/Desktop/flipkart_data/data/outputs/synthetic_demo/week_1_scored_hotspots.parquet`
- Week 2 synthetic scored hotspots: `/Users/pkheria7/Desktop/flipkart_data/data/outputs/synthetic_demo/week_2_scored_hotspots.parquet`