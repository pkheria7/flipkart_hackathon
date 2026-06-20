# M15 Infrastructure Intelligence Backend — Report

## 1. Executive Verdict

**PASS** — M15 backend is operational.
- **243** infra candidates identified
- **3** clusters with recorded assessments
- **1** clusters escalation-ready
- **1** escalation PDFs generated

---

## 2. What M15 Does and Does Not Do

**M15 DOES:**
- Identify STRUCTURAL hotspot candidates for field inspection
- Store officer-recorded site-assessment evidence in SQLite
- Aggregate multi-officer observations to detect escalation readiness
- Generate BBMP/BTP escalation brief PDFs backed by officer attestation
- Export `infra_structural_boost` signal for future scoring integration

**M15 DOES NOT:**
- Automatically detect infrastructure defects from the FTVR dataset
- Claim the dataset contains signage, curb geometry, or parking inventory
- Present demo rows as real police observations
- Modify `pipeline/05_score.py` or any scoring/ROI/LCLE/BCI logic
- Issue official BBMP work orders (PDFs are officer briefs only)

---

## 3. Why Infrastructure Intelligence Is Needed

STRUCTURAL hotspots sustain high violation rates even after repeated enforcement,
suggesting causes beyond officer capacity: missing signage, absent loading zones,
footpath encroachment, or junction conflicts.  M15 creates an evidence trail so
that civil agencies (BBMP) and traffic enforcement (BTP) receive data-backed
escalation briefs rather than informal complaints.

---

## 4. Input Files

| File | Status |
|------|--------|
| scored_hotspots.parquet/csv | OK — 1,084 rows |

---

## 5. Candidate Selection Logic

Total infra candidates: **243**
- STRUCTURAL classification:  **243**
- Signage/infra review action: **243**
- Review-required flag:        **129** (included but flagged)

Selection rule:
```
is_candidate = (classification == 'STRUCTURAL')
             | (recommended_action contains 'signage/infra review')
```

Priority score (inspection priority only — not evidence of defects):
```
infra_priority_score = 0.40 × roi_norm + 0.25 × lcle_norm
                     + 0.20 × pers_norm + 0.15 × bci_norm
```

---

## 6. SQLite Schema

**Table:** `infra_assessments` (24 columns)
**Indexes:** cluster_id, assessment_date, assigned_station, structural_cause_code, suggested_fix, severity

---

## 7. Assessment Workflow

1. Officers use M10 patrol routes to visit STRUCTURAL hotspots
2. Officer records site assessment (condition, signage, footpath, issue flags, cause, fix, severity)
3. SQLite stores each assessment with officer_id and IST timestamp
4. After ≥3 independent officers confirm the same cluster: `escalation_ready = True`
5. CLI or dashboard triggers PDF generation and routes to BBMP/BTP

---

## 8. Escalation Rule

```
escalation_ready = (independent_officer_count >= min_independent_officers)
               AND (max_severity >= 3)
```

Default: `min_independent_officers = 3`.
Three independent officers prevent single-observer bias.
Severity ≥ 3 filters out minor observations.

---

## 9. PDF Generation

PDFs generated: **1**

- `escalation_C_27_0.pdf` (4.5 KB)

Agency mapping: BTP → police_enforcement_only | BBMP → signage/marking/lighting/encroachment | JOINT_BBMP_BTP → loading zone/junction/parking bay

---

## 10. Demo Records Caveat

- Demo rows are **synthetic** — not real police observations
- Marked `source='demo'` in SQLite
- Used only to demonstrate end-to-end PDF generation
- Must be visually distinguished from real assessments in any UI

---

## 11. Output Files

| File | Description |
|------|-------------|
| `data/outputs/infra_assessments.sqlite` | Assessment event store |
| `data/outputs/infra_assessment_summary.csv` | Scoring contract signals |
| `data/outputs/infra_escalation_pdfs/` | Escalation PDF briefs |
| `reports/M15_INFRA_INTEL_REPORT.md` | This report |

---

## 12. Limitations

1. **No real field data.** FTVR lacks signage inventories or parking supply data.
2. **Photo/voice notes are path references only** — not stored blobs.
3. **Demo data is synthetic** and clearly labelled.
4. **PDFs are not official work orders.** Senior officer review required before action.
5. **No GIS boundary enforcement** — station assignment by mode of officer-recorded names.
6. **Single-observer bias risk** mitigated by min_independent_officers threshold.

---

## 13. How M15 Feeds Future Scoring / Dashboard

`get_infra_summary_for_scoring()` columns:
- `infra_structural_boost = 1` for escalation-ready clusters
- `infra_max_severity`, `infra_avg_severity`
- `infra_dominant_cause`, `infra_suggested_fix`

Integration path (not implemented this sprint):
1. Load `infra_assessment_summary.csv` in `pipeline/05_score.py`
2. Add `infra_structural_boost × weight` to ROI formula
3. Show escalation status on officer dashboard (M8)

---

## 14. Final Recommendation

M15 is **ready for operational use** as an officer site-assessment backend.
It provides a structured multi-officer evidence trail for STRUCTURAL hotspots
and automates evidence-backed escalation PDF briefs for BBMP/BTP action.
