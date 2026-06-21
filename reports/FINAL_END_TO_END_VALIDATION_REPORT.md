# Final End-to-End Validation Report

This report validates consistency across the entire pipeline: P1 → P2 → P3 → P4 → M2 → M7 → M1.

## Summary

- Overall verdict: **PASS**
- Checks passed: 24 / 24

## Pipeline stats

- cleaned_rows: 298,277
- clustered_rows: 298,277
- summary_rows: 1,084
- scored_rows: 1,084
- structural_count: 243
- responsive_count: 631
- seasonal_count: 210
- roi_mean: 50.0461
- roi_median: 50.0461
- lcle_mean: 40.5337
- bci_mean: 0.0463

## Checks

| # | check | status | detail |
|---|-------|--------|--------|
| 1 | required_files_exist | PASS | all required files present |
| 2 | cleaned_not_empty | PASS | 298,277 rows |
| 3 | clustered_rows_le_cleaned | PASS | clustered=298,277, cleaned=298,277 |
| 4 | summary_enriched_scored_same_row_count | PASS | summary=1084, enriched=1084, scored=1084 |
| 5 | enriched_covers_all_summary_clusters | PASS | overlap=1084, summary=1084, enriched=1084 |
| 6 | prakhar_covers_all_summary_clusters | PASS | overlap=1084, summary=1084, prakhar=1084 |
| 7 | scored_covers_all_summary_clusters | PASS | overlap=1084, summary=1084, scored=1084 |
| 8 | scored_has_no_noise | PASS | clean |
| 9 | scored_schema_columns | PASS | missing=[], extra=[] |
| 10 | scored_schema_dtypes | PASS | all dtypes match |
| 11 | roi_score_range_0_100 | PASS | min=0.3690, max=100.0000 |
| 12 | lcle_range_0_100 | PASS | min=6.7928, max=100.0000 |
| 13 | bci_range_0_1 | PASS | min=0.0000, max=1.0000 |
| 14 | no_null_required_fields | PASS | no nulls |
| 15 | violation_count_consistent_summary_to_scored | PASS | counts match |
| 16 | feedback_boosted_clusters_are_structural | PASS | boosted=['C_0_0'], structural=True |
| 17 | feedback_summary_matches_enriched_boost | PASS | enriched_boost=['C_0_0'], feedback_boost=['C_0_0'] |
| 18 | classification_values_valid | PASS | classes={'RESPONSIVE', 'STRUCTURAL', 'SEASONAL'} |
| 19 | structural_clusters_have_structural_action | PASS | unique structural actions: ['Recurring patrol + towing support + signage/infra review', 'Review geography first; if confirmed, apply: Recurring patrol + towing support + signage/infra review'] |
| 20 | roi_has_spread | PASS | std=28.8808 |
| 21 | lcle_has_spread | PASS | std=20.4943 |
| 22 | peak_window_populated | PASS | known=100.0% |
| 23 | assigned_station_populated | PASS | assigned=100.0% |
| 24 | vehicle_mix_populated | PASS | populated=100.0% |

## Conclusion

All end-to-end checks passed. The pipeline outputs are internally consistent and ready for demo/deployment.