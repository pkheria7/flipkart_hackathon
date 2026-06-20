# P1 + P2 Data Quality Summary

## Cleaning (P1)
- Raw rows: 298,450
- Cleaned rows: 298,277
- Dropped rows: 173
- Dropped outside bbox: 168
- Dropped unparseable timestamp: 5

### Top vehicle types
- SCOOTER: 95421
- CAR: 87545
- MOTOR CYCLE: 41246
- PASSENGER AUTO: 37562
- MAXI-CAB: 11829
- LGV: 8282
- GOODS AUTO: 2974
- MOPED: 2111
- PRIVATE BUS: 1654
- VAN: 1522

### Top police stations
- UPPARPET: 34468
- SHIVAJINAGAR: 28044
- MALLESHWARAM: 22200
- HAL OLD AIRPORT: 20819
- CITY MARKET: 17646
- VIJAYANAGARA: 14652
- RAJAJINAGAR: 10998
- KODIGEHALLI: 10916
- MAGADI ROAD: 8558
- JEEVANBHEEMANAGAR: 6736

### Top violation type combinations
- ["WRONG PARKING"]: 138722
- ["NO PARKING"]: 119480
- ["PARKING IN A MAIN ROAD", "WRONG PARKING"]: 9468
- ["PARKING IN A MAIN ROAD", "NO PARKING"]: 4810
- ["WRONG PARKING", "DEFECTIVE NUMBER PLATE"]: 3314
- ["NO PARKING", "PARKING IN A MAIN ROAD"]: 2447
- ["NO PARKING", "DEFECTIVE NUMBER PLATE"]: 2378
- ["WRONG PARKING", "PARKING IN A MAIN ROAD"]: 1955
- ["PARKING ON FOOTPATH", "WRONG PARKING"]: 1190
- ["NO PARKING", "WRONG PARKING"]: 891

### Top individual violation types
- WRONG PARKING: 164917
- NO PARKING: 138930
- PARKING IN A MAIN ROAD: 23923
- DEFECTIVE NUMBER PLATE: 7842
- PARKING ON FOOTPATH: 3757
- PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC: 2398
- DOUBLE PARKING: 2037
- PARKING NEAR ROAD CROSSING: 1687
- REFUSE TO GO FOR HIRE: 887
- PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS: 525

### Timestamp usability
- action_taken_timestamp non-null: 0
- closed_datetime non-null: 0
- validation_status non-null: 173,116
- Note: action_taken_timestamp/closed_datetime are mostly NULL in this anonymized dataset; do not rely on them for classification.

## Clustering (P2)
- Total clustered rows: 260,462
- Noise rows: 37,815
- Number of real clusters: 1,019

## Cluster quality distribution
- medium: 757
- good: 247
- needs_review: 15
- Clusters flagged for manual review: 543

## Notes
- DBSCAN parameters: eps=20.0m, min_samples=15, metric=haversine.
- Noise points retain cluster_id='NOISE' so the row-level table is complete.
- All timestamps are in Asia/Kolkata (IST).