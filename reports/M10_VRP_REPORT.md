# M10 Patrol Route Optimizer — VRP Report

## 1. Executive Verdict

**PASS** — Routes generated for **54 stations** covering **410 selected stops**.
Routing mode used: **graph**.

---

## 2. Input Files

| File | Rows | Stations |
|------|------|----------|
| `data\outputs\scored_hotspots.parquet` | 1,084 | 54 |

---

## 3. Routing Mode

| Parameter | Value |
|-----------|-------|
| Requested | `auto` |
| Used | `graph` |
| Graph path | `C:\Users\Prakhar Parashar\Documents\GRID_HACKATHON\flipkart_hackathon\cache\bengaluru_drive_graph.graphml` |
| Graph load status | loaded |
| Graph nodes | 236,481 |
| Graph edges | 584,823 |
| Shortest-path weight | `travel_time` |
| Graph legs | 5,006 of 5,006 (100%) |
| Haversine fallback legs | 0 |

**Important caveats on routing accuracy:**

- OSM road graph estimates routing on the mapped road network,
  not live traffic conditions. Actual travel times may differ
  due to signals, congestion, and road events.
- `travel_time` weights are derived from posted speed limits,
  not measured traffic speed.
- Haversine fallback used for legs where graph path was not found.
- No real-time traffic or signal delay is modelled in either mode.
- No police station depot coordinates are used; routes start at the
  highest-reward hotspot for each station.

---

## 4. Optimization Method

### Why max-reward-with-skipping, not visit-every-hotspot

A station like HAL OLD AIRPORT has 51 candidates. A patrol team in
3 hours with 10 min/stop and road-network travel can cover 8 stops.
Visiting all 51 would require 8+ hours — operationally infeasible.

### Algorithm: Greedy Orienteering Heuristic

1. **Candidate pool:** Top 25 hotspots by `roi_score` per station.
2. **Seed:** Highest `route_reward` hotspot (tiebreak: cluster_id asc).
3. **Greedy step:** Maximise `route_reward / (leg_min + service_min + 1)`.
4. **Feasibility:** Skip candidates that push elapsed time past 3 hours.

### Routing hierarchy per leg

1. **scipy.sparse.csgraph.dijkstra precomputation** (if graph loaded) —
   all pairwise legs for the station pool in one batch call per pool node.
2. **NetworkX bidirectional_dijkstra** — per-leg fallback if scipy missed a pair.
3. **Haversine** — final fallback if graph routing fails for any reason.

### Route Reward Formula

```
route_reward = 0.55 × (roi_score / 100)
            + 0.20 × (bci / max_bci_global)
            + 0.15 × (lcle_pct / 100)
            + 0.10 × min_max_norm(persistence, global)
            + 0.05   [if classification == STRUCTURAL]
```

---

## 5. Constraints

| Parameter | Value |
|-----------|-------|
| Max route duration | 180 min |
| Max stops per route | 8 |
| Service time per stop | 10 min |
| Speed (haversine / length fallback) | 18.0 km/h |
| Candidate pool per station | 25 |

---

## 6. Output Files

| File | Contents |
|------|----------|
| `data/outputs/patrol_routes.json` | Metadata + route objects with stop arrays |
| `data/outputs/patrol_routes.csv` | One row per stop (24 columns including routing fields) |
| `reports/M10_VRP_REPORT.md` | This report |

---

## 7. Route Summary

| Metric | Value |
|--------|-------|
| Total stations | 54 |
| Total routes | 54 |
| Total hotspots in input | 1,084 |
| Total candidates evaluated | 925 |
| Total selected stops | 410 |
| Average stops per route | 7.6 |
| Average route duration | 90.9 min |
| Average ROI of selected stops | 70.0 |
| Routes with ≥1 review-required stop | 54 |

---

## 8. Top 10 Station Routes by Total Route Reward

| Route ID | Station | Stops | Reward | Avg ROI | Duration | Primary Peak | Peak Align% |
|---|---|---|---|---|---|---|---|
| ROUTE_HAL_OLD_AIRPORT_001 | HAL OLD AIRPORT | 8 | 5.8139 | 95.2 | 88 min | 08:00-10:00 | 50% |
| ROUTE_YESHWANTHPURA_001 | YESHWANTHPURA | 8 | 5.7840 | 92.3 | 86 min | 10:00-12:00 | 38% |
| ROUTE_RAJAJINAGAR_001 | RAJAJINAGAR | 8 | 5.2493 | 88.0 | 93 min | 03:00-05:00 | 50% |
| ROUTE_MAHADEVAPURA_001 | MAHADEVAPURA | 8 | 5.2277 | 91.1 | 112 min | 03:00-05:00 | 25% |
| ROUTE_MALLESHWARAM_001 | MALLESHWARAM | 8 | 5.2072 | 86.7 | 95 min | 10:00-12:00 | 38% |
| ROUTE_SHIVAJINAGAR_001 | SHIVAJINAGAR | 8 | 5.1952 | 89.7 | 92 min | 10:00-12:00 | 62% |
| ROUTE_JEEVANBHEEMANAGAR_001 | JEEVANBHEEMANAGAR | 8 | 5.1236 | 91.6 | 88 min | 13:00-15:00 | 25% |
| ROUTE_KODIGEHALLI_001 | KODIGEHALLI | 8 | 5.0883 | 91.6 | 88 min | 11:00-13:00 | 50% |
| ROUTE_VIJAYANAGARA_001 | VIJAYANAGARA | 8 | 5.0800 | 92.8 | 92 min | 10:00-12:00 | 50% |
| ROUTE_BELLANDUR_001 | BELLANDUR | 8 | 4.9569 | 86.2 | 96 min | 02:00-04:00 | 25% |

---

## 9. Example Route Detail Tables

### UPPARPET

**Route:** `ROUTE_UPPARPET_001`  | Stops: **8**  | Est. Duration: **88 min**  | Total Reward: **4.8763**

| Seq | Cluster | Road | LCLE% | ROI | Reward | Violations | Peak Window | Class | Routing | Review? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | C_0_1 | tertiary | 100.0 | 74.7 | 0.701 | 23,553 | 09:00-11:00 | STRUCTURAL | start | Yes |
| 2 | C_0_5 | primary | 60.8 | 96.6 | 0.683 | 2,030 | 09:00-11:00 | STRUCTURAL | graph | Yes |
| 3 | C_0_4 | primary | 54.9 | 93.5 | 0.653 | 1,009 | 08:00-10:00 | STRUCTURAL | graph | Yes |
| 4 | C_0_7 | tertiary | 59.7 | 95.1 | 0.676 | 459 | 04:00-06:00 | STRUCTURAL | graph | Yes |
| 5 | C_0_2 | residential | 100.0 | 79.2 | 0.670 | 8,323 | 09:00-11:00 | STRUCTURAL | graph | Yes |
| 6 | C_0_21 | primary | 20.0 | 76.0 | 0.505 | 78 | 08:00-10:00 | STRUCTURAL | graph | No |
| 7 | C_0_39 | tertiary | 37.6 | 78.6 | 0.500 | 46 | 04:00-06:00 | RESPONSIVE | graph | No |
| 8 | C_0_19 | secondary | 29.4 | 78.0 | 0.487 | 35 | 07:00-09:00 | RESPONSIVE | graph | No |

### HAL OLD AIRPORT

**Route:** `ROUTE_HAL_OLD_AIRPORT_001`  | Stops: **8**  | Est. Duration: **88 min**  | Total Reward: **5.8139**

| Seq | Cluster | Road | LCLE% | ROI | Reward | Violations | Peak Window | Class | Routing | Review? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | C_126 | trunk_link | 100.0 | 99.5 | 0.832 | 939 | 08:00-10:00 | STRUCTURAL | start | Yes |
| 2 | C_298 | trunk | 50.9 | 100.0 | 0.828 | 1,409 | 08:00-10:00 | STRUCTURAL | graph | Yes |
| 3 | C_276 | trunk | 30.1 | 95.7 | 0.719 | 47 | 08:00-10:00 | RESPONSIVE | graph | No |
| 4 | C_274 | tertiary | 98.3 | 86.3 | 0.643 | 39 | 08:00-10:00 | RESPONSIVE | graph | No |
| 5 | C_168 | tertiary | 81.1 | 97.7 | 0.728 | 1,186 | 03:00-05:00 | STRUCTURAL | graph | Yes |
| 6 | C_405 | tertiary | 49.1 | 95.3 | 0.675 | 186 | 06:00-08:00 | STRUCTURAL | graph | No |
| 7 | C_294 | trunk | 21.7 | 94.2 | 0.697 | 42 | 09:00-11:00 | RESPONSIVE | graph | No |
| 8 | C_876 | trunk | 28.0 | 92.6 | 0.691 | 30 | 10:00-12:00 | RESPONSIVE | graph | No |

### CITY MARKET

**Route:** `ROUTE_CITY_MARKET_001`  | Stops: **8**  | Est. Duration: **89 min**  | Total Reward: **4.6559**

| Seq | Cluster | Road | LCLE% | ROI | Reward | Violations | Peak Window | Class | Routing | Review? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | C_0_0 | primary | 75.6 | 99.9 | 0.778 | 10,667 | 01:00-03:00 | STRUCTURAL | start | No |
| 2 | C_0_3 | tertiary | 54.2 | 94.7 | 0.663 | 899 | 10:00-12:00 | STRUCTURAL | graph | Yes |
| 3 | C_0_33 | trunk | 26.4 | 91.2 | 0.575 | 139 | 08:00-10:00 | SEASONAL | graph | No |
| 4 | C_564 | residential | 59.7 | 77.7 | 0.571 | 88 | 00:00-02:00 | STRUCTURAL | graph | No |
| 5 | C_0_10 | primary | 43.5 | 80.0 | 0.558 | 480 | 09:00-11:00 | STRUCTURAL | graph | Yes |
| 6 | C_0_15 | primary | 35.8 | 69.4 | 0.487 | 145 | 11:00-13:00 | STRUCTURAL | graph | No |
| 7 | C_81 | tertiary | 100.0 | 56.5 | 0.518 | 2,187 | 11:00-13:00 | STRUCTURAL | graph | Yes |
| 8 | C_585 | primary | 42.7 | 76.5 | 0.505 | 30 | 03:00-05:00 | RESPONSIVE | graph | No |

---

## 10. Skipped Hotspots

| Stage | Count |
|-------|-------|
| Total hotspots in scored_hotspots | 1,084 |
| Entered candidate pools | 925 |
| Skipped by pool filter (below roi_score threshold) | 159 |
| Skipped by time budget or benefit/distance ratio | 515 |
| Selected as route stops | 410 |

---

## 11. Validation Checks

### Input Validation

- **required_columns_present:** PASS — all present
- **no_null_cluster_id:** PASS — 0 nulls
- **no_null_coordinates:** PASS — no null coordinates
- **no_null_assigned_station:** PASS — 0 nulls
- **roi_score_valid_range:** PASS — all in [0, 100]
- **positive_violation_count:** PASS — 0 non-positive
- **row_count_positive:** PASS — 1,084 rows loaded

### Route Validation

- **at_least_one_route:** PASS — 54 routes
- **all_routes_have_stops:** PASS — 0 empty routes
- **stop_count_within_limit:** PASS — all <= 8
- **route_time_within_limit:** PASS — all multi-stop <= 180 min
- **no_duplicate_stops_within_route:** PASS — no duplicates
- **route_ids_unique:** PASS — 54 routes, 54 unique IDs
- **route_count_matches_stations:** PASS — 54 routes, 54 eligible stations

---

## 12. Limitations

1. **No live traffic.** Travel times from the OSM graph use speed limits,
   not real-time congestion data. Actual times in peak Bengaluru traffic
   may be 30-100% longer than estimated.
2. **No police station depot.** Routes start at the highest-reward hotspot,
   not the station building. Return travel is not included in time budget.
3. **Greedy, not exact.** The heuristic does not guarantee the globally
   optimal stop sequence. An exact VRP solver would improve routes ~5-15%.
4. **One route per station.** Stations with 51+ hotspots may warrant
   separate AM/PM shift routes.
5. **Peak windows not hard-constrained.** `peak_alignment_score` measures
   how well route stops share a peak window; future versions could split
   routes by time window.
6. **Review-required stops not excluded.** Stops flagged `review_required`
   remain in the route for officer awareness, not for automatic exclusion.

---

## 13. Final Recommendation

M10 Patrol Route Optimizer is **ready for operational use** (PASS).

- Station officers can use `patrol_routes.json/csv` for patrol planning.
- Wire M12 `feedback_structural_boost` into `route_reward` for confirmed
  recurrent clusters to rank higher.
- For production deployment, replace graph speed limits with real GPS traces
  from patrol vehicles to calibrate travel times.
