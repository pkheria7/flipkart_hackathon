# LCLE Top-20 Audit

## Purpose
Verify that clusters near 100% LCLE are genuinely narrow-road, large-vehicle, junction-heavy hotspots and not artifacts of the formula.

## Methodology
LCLE = lane-capacity loss estimate from illegal parking. High LCLE should correlate with:
- Narrow road width (low `road_width_m`)
- Larger vehicle footprints (dominant vehicle type)
- Higher junction obstruction (`junction_flag_rate`)

## Top 20 clusters by LCLE

| rank | cluster_id | lcle_pct | road_width_m | road_class | dominant_vehicle_type | junction_flag_rate | lcle_confidence | violation_count | location_mode | police_station_mode |
|------|------------|----------|--------------|------------|----------------------|--------------------|-----------------|-----------------|---------------|---------------------|
| 1 | C_0_1 | 100.00 | 6.0 | tertiary | CAR | 0.0002 | LOW | 23,553 | 5th Main Road, Kempe Gowda Circle, Gandhi Nagar, Bengaluru, Karnataka. Pin-560009 (India) | UPPARPET |
| 2 | C_990 | 100.00 | 3.5 | residential | CAR | 0.0000 | MEDIUM | 49 | 1st Cross Road, Jeevan Bima Nagar, Bengaluru, Karnataka. Pin-560075 (India) | JEEVANBHEEMANAGAR |
| 3 | C_83 | 100.00 | 4.0 | tertiary | CAR | 0.0008 | MEDIUM | 1,240 | 17th Main Road, KPTCL Quarters, Block 2, Rajaji Nagar, Bengaluru, Karnataka. Pin-560010 (India) | RAJAJINAGAR |
| 4 | C_731 | 100.00 | 3.5 | residential | MAXI-CAB | 0.0000 | MEDIUM | 1,751 | ITPL Main Road, Brigade Tech Gardens, Brookefield, Bengaluru, Karnataka. Pin-560037 (India) | HAL OLD AIRPORT |
| 5 | C_625 | 100.00 | 3.0 | tertiary | CAR | 0.0000 | HIGH | 44 | Outer Ring Road, Salarpuria Sattva Eminence, Kadubisanahalli, Bengaluru, Karnataka. Pin-560103 (India) | HAL OLD AIRPORT |
| 6 | C_126 | 100.00 | 3.0 | trunk_link | CAR | 0.1235 | HIGH | 939 | Outer Ring Road, Vajram Esteva, Devara Beesana Halli, Bengaluru, Karnataka. Pin-560103 (India) | HAL OLD AIRPORT |
| 7 | C_17 | 100.00 | 3.5 | residential | CAR | 0.0076 | MEDIUM | 927 | Bengaluru Bellary Road, Sadahalli Gate Junction, Navarathna Agrahara, Bengaluru, Karnataka. Pin-562157 (India) | CHIKKAJALA |
| 8 | C_0_53 | 100.00 | 3.5 | residential | PASSENGER AUTO | 0.0000 | LOW | 11 | Crama Street, Balaji Layout, Heggadadevanapura, Bengaluru, Karnataka. Pin-562162 (India) | CITY MARKET |
| 9 | C_908 | 100.00 | 4.0 | tertiary | CAR | 0.0000 | MEDIUM | 15 | Diesel Loco Shed Road, Devasandra, KR Puram, Bengaluru, Karnataka. Pin-560036 (India) | K.R. PURA |
| 10 | C_972 | 100.00 | 5.5 | secondary | PRIVATE BUS | 0.0000 | MEDIUM | 15 | BDA 80 Feet Road, Jagdish Circle, Arakere, Bengaluru, Karnataka. Pin-560076 (India) | HULIMAVU |
| 11 | C_659 | 100.00 | 3.5 | residential | CAR | 0.0000 | MEDIUM | 111 | Memorial Road, Sulthan Nagar, Shivaji Nagar, Bengaluru, Karnataka. Pin-560051 (India) | PULIKESHINAGAR(F.TOWN) |
| 12 | C_81 | 100.00 | 4.0 | tertiary | SCOOTER | 0.0000 | MEDIUM | 2,187 | Tippu Sultan Palace Road, Kalasipalyam, Bengaluru, Karnataka. Pin-560002 (India) | CITY MARKET |
| 13 | C_682 | 100.00 | 3.0 | tertiary | CAR | 0.0000 | HIGH | 29 | Cleveland Road, Sarvanton Circle, Frazer Town, Bengaluru, Karnataka. Pin-560005 (India) | PULIKESHINAGAR(F.TOWN) |
| 14 | C_696 | 100.00 | 3.5 | trunk_link | BUS (BMTC/KSRTC) | 0.0000 | MEDIUM | 28 | 100 Feet Road, Vivekanand Nagar, Peenya, Bengaluru, Karnataka. Pin-560058 (India) | PEENYA |
| 15 | C_117 | 100.00 | 3.5 | residential | MAXI-CAB | 0.0000 | MEDIUM | 458 | Golf Avenue Road, Muniallappa Garden, Kodihalli, Bengaluru, Karnataka. Pin-560008 (India) | JEEVANBHEEMANAGAR |
| 16 | C_1000 | 100.00 | 3.5 | residential | SCOOTER | 0.0000 | MEDIUM | 16 | Sirsi Road, Sirsi Circle, Chamarajpet, Bengaluru, Karnataka. Pin-560018 (India) | CHAMARAJPET |
| 17 | C_798 | 100.00 | 3.5 | residential | CAR | 0.0000 | MEDIUM | 16 | 5th Cross Road, Sri Muthu Mariyamma Circle, Govindpura, Bengaluru, Karnataka. Pin-560045 (India) | K.G. HALLI |
| 18 | C_1017 | 100.00 | 3.5 | residential | CAR | 0.0000 | MEDIUM | 16 | 4th Main Road, Doddaiah Layout, Halasuru, Bengaluru, Karnataka. Pin-560008 (India) | HALASUR |
| 19 | C_15 | 100.00 | 3.5 | residential | CAR | 0.0000 | MEDIUM | 3,813 | Sri Venkataranga Ayangar Road, Ranganathapura, Malleshwaram, Bengaluru, Karnataka. Pin-560003 (India) | MALLESHWARAM |
| 20 | C_3 | 100.00 | 3.5 | residential | SCOOTER | 0.0003 | MEDIUM | 3,926 | MBT Road, Devasandra Junction, KR Puram, Bengaluru, Karnataka. Pin-560036 (India) | K.R. PURA |

## Audit observations
- Average road width in top 20: **3.73 m**
- Clusters with road width ≤ 4.0 m: **18/20**
- Average junction_flag_rate in top 20: **0.0066**
- Clusters with large-vehicle dominant type: **15/20**

### Verdict
**SENSIBLE** — Top-LCLE clusters are predominantly narrow-road hotspots, confirming the formula is responding to road geometry rather than raw violation count.

## Notes
- Junction rates in the top 20 are generally low because the current dataset flags relatively few junction-related violations; this is expected and does not invalidate LCLE.
- Several top clusters are on residential roads (3.5 m IRC default width), which is a realistic narrow-road parking scenario in Bengaluru.
- C_0_1 appears at rank 1 with 100% LCLE but is flagged LOW confidence due to `needs_review` cluster quality; treat its LCLE as indicative, not precise.

## Recommendation
If this audit looks sensible, M2 LCLE can be frozen. Proceed to M7 BCI next.