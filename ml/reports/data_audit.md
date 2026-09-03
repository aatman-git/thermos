# THERMOS Dataset - Data Audit Report

**Generated:** 2026-09-01 18:21:34

## Dataset Overview

- **Rows:** 36,000
- **Columns:** 15
- **Features:** 14 (excluding target)
- **Target:** label

## Class Distribution

| Class | Count | Percentage |
|-------|-------|------------|
| Agricultural Burning | 6,000 | 16.67% |
| Gas Flare | 6,000 | 16.67% |
| Industrial Fire | 6,000 | 16.67% |
| Industrial Thermal Source | 6,000 | 16.67% |
| Mining Activity | 6,000 | 16.67% |
| Wildfire | 6,000 | 16.67% |

## Data Types

- **brightness_k**: float64
- **frp_mw**: float64
- **firms_confidence_pct**: int64
- **daynight**: int64
- **observation_count_7d**: int64
- **persistence_hours_7d**: float64
- **frp_trend_pct**: float64
- **industrial_proximity_km**: float64
- **refinery_proximity_km**: float64
- **mine_proximity_km**: float64
- **forest_proximity_km**: float64
- **cropland_proximity_km**: float64
- **population_5km**: int64
- **land_cover**: object
- **label**: object

## Missing Values

No missing values found.

## Duplicate Rows

- **Total duplicates:** 0 (0.0%)

## Numeric Feature Statistics

### brightness_k
- Min: 290.0000
- Max: 367.0000
- Mean: 344.3769
- Median: 344.8700
- Std: 15.6220
- Skew: -0.3308
- Kurtosis: -0.5057

### frp_mw
- Min: 0.2900
- Max: 1500.0000
- Mean: 53.3897
- Median: 27.7750
- Std: 85.2997
- Skew: 6.3283
- Kurtosis: 67.0830

### firms_confidence_pct
- Min: 60.0000
- Max: 100.0000
- Mean: 89.2321
- Median: 89.0000
- Std: 6.6224
- Skew: -0.2778
- Kurtosis: -0.3932

### daynight
- Min: 0.0000
- Max: 1.0000
- Mean: 0.8432
- Median: 1.0000
- Std: 0.3636
- Skew: -1.8880
- Kurtosis: 1.5648

### observation_count_7d
- Min: 1.0000
- Max: 40.0000
- Mean: 13.1201
- Median: 11.0000
- Std: 8.8663
- Skew: 0.9294
- Kurtosis: 0.2353

### persistence_hours_7d
- Min: 0.5000
- Max: 167.9900
- Mean: 74.2447
- Median: 71.5800
- Std: 49.6547
- Skew: 0.2028
- Kurtosis: -1.1719

### frp_trend_pct
- Min: -50.3900
- Max: 88.8500
- Mean: 13.4069
- Median: 10.7700
- Std: 16.0574
- Skew: 0.6456
- Kurtosis: 0.5195

### industrial_proximity_km
- Min: 0.1000
- Max: 69.9800
- Mean: 13.4718
- Median: 3.8100
- Std: 16.3442
- Skew: 1.4574
- Kurtosis: 1.4978

### refinery_proximity_km
- Min: 0.1000
- Max: 150.0000
- Mean: 34.4683
- Median: 9.7950
- Std: 38.5190
- Skew: 1.0342
- Kurtosis: -0.0169

### mine_proximity_km
- Min: 0.1000
- Max: 119.9800
- Mean: 36.7145
- Median: 30.8500
- Std: 29.2563
- Skew: 0.7746
- Kurtosis: -0.1895

### forest_proximity_km
- Min: 0.0100
- Max: 149.9700
- Mean: 47.5962
- Median: 45.5100
- Std: 34.4036
- Skew: 0.5995
- Kurtosis: 0.0387

### cropland_proximity_km
- Min: 0.0500
- Max: 149.9800
- Mean: 39.2816
- Median: 34.4900
- Std: 32.6101
- Skew: 1.1100
- Kurtosis: 1.1918

### population_5km
- Min: 1.0000
- Max: 99663.0000
- Mean: 1491.2354
- Median: 180.0000
- Std: 3671.2083
- Skew: 6.6456
- Kurtosis: 78.2634

## Categorical Features

### land_cover (8 unique values)
- Bare Land: 10,679 (29.66%)
- Industrial: 9,854 (27.37%)
- Built-up: 5,039 (14.00%)
- Grassland: 3,477 (9.66%)
- Mining: 2,013 (5.59%)
- Cropland: 1,959 (5.44%)
- Forest: 1,506 (4.18%)
- Shrubland: 1,473 (4.09%)

### label (6 unique values)
- Industrial Fire: 6,000 (16.67%)
- Industrial Thermal Source: 6,000 (16.67%)
- Gas Flare: 6,000 (16.67%)
- Agricultural Burning: 6,000 (16.67%)
- Wildfire: 6,000 (16.67%)
- Mining Activity: 6,000 (16.67%)

## Suspicious Values

- **daynight_zero**: 5644
- **frp_trend_pct_negative**: 6936
- **frp_trend_pct_zero**: 12

## Impossible Values Check

- **brightness_k_lt_0**: 0
- **brightness_k_gt_1000**: 0
- **frp_mw_lt_0**: 0
- **confidence_lt_0**: 0
- **confidence_gt_100**: 0
- **daynight_not_binary**: -36001
- **obs_count_lt_0**: 0
- **persistence_lt_0**: 0
- **persistence_gt_168**: 0
- **frp_trend_lt_neg100**: 0
- **pop_lt_0**: 0

## High Correlations (|r| > 0.9)

No correlations > 0.9 found.

## Notes

- This dataset appears to be synthetic/development data.
- Metrics from this data should NOT be claimed as real-world NASA/NTRO performance.
- All preprocessing and modeling decisions are documented for reproducibility.
