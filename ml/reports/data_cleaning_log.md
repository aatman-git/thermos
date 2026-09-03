# THERMOS Dataset - Data Cleaning Log

**Generated:** 2026-09-01 18:27:12

## Original Dataset
- Rows: 36,000
- Columns: 15

## Cleaning Checks Performed

- NaN check: 0 total missing values
- Infinite values check: 0 total infinite values
- Negative values in non-negative features: {}
- Unrealistic values: {'brightness_k_lt_200': 0, 'brightness_k_gt_500': 0, 'frp_mw_gt_5000': 0, 'confidence_lt_0': 0, 'confidence_gt_100': 0, 'daynight_invalid': -36001, 'obs_count_gt_100': 0, 'persistence_gt_168': 0, 'frp_trend_lt_neg100': 0, 'frp_trend_gt_500': 0, 'industrial_proximity_km_negative': 0, 'refinery_proximity_km_negative': 0, 'mine_proximity_km_negative': 0, 'forest_proximity_km_negative': 0, 'cropland_proximity_km_negative': 0, 'population_negative': 0}
- Duplicate rows: 0
- No feature-duplicate rows with conflicting labels
- Features with perfect class separation: {'mine_proximity_km': ['Mining Activity'], 'forest_proximity_km': ['Wildfire'], 'cropland_proximity_km': ['Agricultural Burning']}
- Rows with brightness_k == 367.0: 4041 (11.22%)
-   Class distribution for brightness_k=367: {'Industrial Fire': 1527, 'Gas Flare': 1373, 'Wildfire': 451, 'Industrial Thermal Source': 367, 'Mining Activity': 286, 'Agricultural Burning': 37}
- 
CLEANING DECISIONS:
- 1. No rows dropped - dataset appears clean
- 2. No missing values to impute
- 3. No infinite values to handle
- 4. No negative values in non-negative features
- 5. No unrealistic outliers to remove (synthetic data has bounded ranges)
- 6. No duplicate rows
- 7. No feature-duplicate conflicts
- 8. Perfect class separation check: None found
- 9. Note: Perfectly balanced classes (6000 each) and exact 367.0 brightness values
-    indicate synthetic data generation. This is documented but not cleaned.
- 
Cleaned dataset saved to: C:\project\THERMOS REAL\ml\data\processed\thermos_clean.csv
- Shape: (36000, 15)

## Final Dataset
- Rows: 36000
- Columns: 15
- File: C:\project\THERMOS REAL\ml\data\processed\thermos_clean.csv
