# THERMOS Dataset - Leakage Check Report
**Generated:** 2026-09-01 18:32:43
## Dataset Overview
- Rows: 36,000
- Columns: 15
- Target: label

## 1. Perfect Feature-Class Separation
The following features perfectly separate specific classes:

- **mine_proximity_km** perfectly separates **Mining Activity**
  - Class range: [0.1000, 3.5000]
  - Other range: [5.0000, 119.9800]
  - **LEAKAGE SUSPECTED**: This feature was likely generated using label information

- **forest_proximity_km** perfectly separates **Wildfire**
  - Class range: [0.0100, 4.0000]
  - Other range: [5.0100, 149.9700]
  - **LEAKAGE SUSPECTED**: This feature was likely generated using label information

- **cropland_proximity_km** perfectly separates **Agricultural Burning**
  - Class range: [0.0500, 3.0000]
  - Other range: [3.0100, 149.9800]
  - **LEAKAGE SUSPECTED**: This feature was likely generated using label information

## 2. Feature Distributions by Class (Summary Statistics)

### brightness_k
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 334.69 | 12.79 | 290.00 | 367.00 |
| Gas Flare | 352.95 | 12.99 | 298.99 | 367.00 |
| Industrial Fire | 352.45 | 14.15 | 290.00 | 367.00 |
| Industrial Thermal Source | 344.61 | 13.46 | 290.00 | 367.00 |
| Mining Activity | 341.57 | 14.40 | 290.00 | 367.00 |
| Wildfire | 340.00 | 16.85 | 290.00 | 367.00 |

### frp_mw
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 23.21 | 30.37 | 0.29 | 437.38 |
| Gas Flare | 100.87 | 141.59 | 0.92 | 1500.00 |
| Industrial Fire | 68.78 | 90.51 | 1.21 | 1500.00 |
| Industrial Thermal Source | 36.58 | 41.80 | 0.68 | 729.30 |
| Mining Activity | 36.83 | 46.75 | 0.48 | 1029.21 |
| Wildfire | 54.07 | 81.28 | 0.64 | 1500.00 |

### firms_confidence_pct
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 89.38 | 6.62 | 67.00 | 100.00 |
| Gas Flare | 89.18 | 6.64 | 60.00 | 100.00 |
| Industrial Fire | 89.32 | 6.55 | 64.00 | 100.00 |
| Industrial Thermal Source | 89.04 | 6.65 | 64.00 | 100.00 |
| Mining Activity | 89.17 | 6.69 | 65.00 | 100.00 |
| Wildfire | 89.30 | 6.59 | 67.00 | 100.00 |

### daynight
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 0.47 | 0.50 | 0.00 | 1.00 |
| Gas Flare | 1.00 | 0.00 | 1.00 | 1.00 |
| Industrial Fire | 0.97 | 0.18 | 0.00 | 1.00 |
| Industrial Thermal Source | 0.99 | 0.09 | 0.00 | 1.00 |
| Mining Activity | 0.85 | 0.36 | 0.00 | 1.00 |
| Wildfire | 0.78 | 0.41 | 0.00 | 1.00 |

### observation_count_7d
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 4.50 | 2.07 | 1.00 | 8.00 |
| Gas Flare | 25.27 | 8.66 | 10.00 | 40.00 |
| Industrial Fire | 6.97 | 2.33 | 3.00 | 11.00 |
| Industrial Thermal Source | 16.96 | 6.34 | 6.00 | 28.00 |
| Mining Activity | 11.48 | 4.93 | 3.00 | 20.00 |
| Wildfire | 13.54 | 6.71 | 2.00 | 25.00 |

### persistence_hours_7d
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 9.26 | 5.04 | 0.50 | 18.00 |
| Gas Flare | 113.88 | 31.34 | 60.00 | 167.99 |
| Industrial Fire | 49.28 | 23.86 | 8.03 | 89.98 |
| Industrial Thermal Source | 95.49 | 41.31 | 24.00 | 167.98 |
| Mining Activity | 90.34 | 45.01 | 12.03 | 167.98 |
| Wildfire | 87.21 | 46.79 | 6.01 | 167.98 |

### frp_trend_pct
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 10.18 | 16.67 | -50.39 | 67.79 |
| Gas Flare | 0.89 | 6.06 | -20.15 | 22.33 |
| Industrial Fire | 25.40 | 13.22 | -24.68 | 80.41 |
| Industrial Thermal Source | 6.74 | 7.67 | -20.84 | 36.44 |
| Mining Activity | 9.95 | 10.03 | -26.67 | 46.64 |
| Wildfire | 27.28 | 18.40 | -37.44 | 88.85 |

### industrial_proximity_km
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 17.20 | 7.49 | 4.01 | 30.00 |
| Gas Flare | 2.05 | 1.12 | 0.10 | 4.00 |
| Industrial Fire | 1.36 | 0.67 | 0.20 | 2.50 |
| Industrial Thermal Source | 1.54 | 0.84 | 0.10 | 3.00 |
| Mining Activity | 21.07 | 11.05 | 2.00 | 40.00 |
| Wildfire | 37.61 | 18.67 | 5.05 | 69.98 |

### refinery_proximity_km
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 55.04 | 25.94 | 10.01 | 100.00 |
| Gas Flare | 3.00 | 1.69 | 0.10 | 6.00 |
| Industrial Fire | 4.26 | 2.14 | 0.50 | 8.00 |
| Industrial Thermal Source | 5.21 | 2.77 | 0.40 | 10.00 |
| Mining Activity | 54.20 | 26.15 | 8.00 | 99.97 |
| Wildfire | 85.10 | 37.35 | 20.00 | 150.00 |

### mine_proximity_km
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 57.09 | 24.44 | 15.00 | 99.99 |
| Gas Flare | 45.26 | 20.26 | 10.03 | 79.99 |
| Industrial Fire | 22.41 | 10.09 | 5.00 | 40.00 |
| Industrial Thermal Source | 25.96 | 10.97 | 7.01 | 45.00 |
| Mining Activity | 1.80 | 0.98 | 0.10 | 3.50 |
| Wildfire | 67.76 | 30.22 | 15.04 | 119.98 |

### forest_proximity_km
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 43.87 | 20.74 | 8.01 | 79.98 |
| Gas Flare | 90.13 | 35.05 | 30.02 | 149.97 |
| Industrial Fire | 46.95 | 18.74 | 15.01 | 80.00 |
| Industrial Thermal Source | 60.38 | 22.83 | 20.02 | 99.99 |
| Mining Activity | 42.25 | 21.80 | 5.01 | 80.00 |
| Wildfire | 1.99 | 1.15 | 0.01 | 4.00 |

### cropland_proximity_km
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 1.54 | 0.85 | 0.05 | 3.00 |
| Gas Flare | 84.64 | 37.43 | 20.01 | 149.98 |
| Industrial Fire | 34.43 | 14.87 | 8.01 | 59.98 |
| Industrial Thermal Source | 45.98 | 19.58 | 12.00 | 79.98 |
| Mining Activity | 42.41 | 21.73 | 5.01 | 80.00 |
| Wildfire | 26.69 | 13.52 | 3.01 | 49.99 |

### population_5km
| Class | Mean | Std | Min | Max |
|-------|------|-----|-----|-----|
| Agricultural Burning | 322.87 | 398.63 | 6.00 | 6615.00 |
| Gas Flare | 162.07 | 220.54 | 3.00 | 5340.00 |
| Industrial Fire | 3298.52 | 4189.05 | 49.00 | 60489.00 |
| Industrial Thermal Source | 5002.94 | 6355.23 | 80.00 | 99663.00 |
| Mining Activity | 80.66 | 98.22 | 1.00 | 1699.00 |
| Wildfire | 80.34 | 96.81 | 1.00 | 1113.00 |

## 3. Feature-Label Mutual Information (Proxy Check)
| Feature | Mutual Information |
|---------|-------------------|
| industrial_proximity_km | 0.8908 |
| refinery_proximity_km | 0.8686 |
| mine_proximity_km | 0.7990 |
| land_cover | 0.7846 |
| cropland_proximity_km | 0.7696 |
| forest_proximity_km | 0.7213 |
| observation_count_7d | 0.6011 |
| population_5km | 0.5981 |
| persistence_hours_7d | 0.5524 |
| frp_trend_pct | 0.3169 |
| daynight | 0.1334 |
| brightness_k | 0.1100 |
| frp_mw | 0.0885 |
| firms_confidence_pct | 0.0025 |

**HIGH MUTUAL INFORMATION FEATURES (Potential Leakage):**
- industrial_proximity_km: MI = 0.8908
- refinery_proximity_km: MI = 0.8686
- mine_proximity_km: MI = 0.7990
- land_cover: MI = 0.7846
- cropland_proximity_km: MI = 0.7696
- forest_proximity_km: MI = 0.7213
- observation_count_7d: MI = 0.6011
- population_5km: MI = 0.5981
- persistence_hours_7d: MI = 0.5524

## 4. Synthetic Data Artifacts
- **brightness_k == 367.0**: 4041 rows (11.22%)
  - This exact value appearing frequently suggests a capped/clipped synthetic generation
  - In real FIRMS data, brightness temperatures are continuous

- **Perfectly balanced classes**: Each class has exactly 6000 samples
  - Real-world data would never be perfectly balanced
  - This confirms synthetic/stratified generation

## 5. Geospatial Proximity Features Analysis

### Proximity Feature Means by Class:
| Class | Industrial | Refinery | Mine | Forest | Cropland |
|-------|------------|----------|------|--------|----------|
| Agricultural Burning | 17.20 | 55.04 | 57.09 | 43.87 | 1.54 |
| Gas Flare | 2.05 | 3.00 | 45.26 | 90.13 | 84.64 |
| Industrial Fire | 1.36 | 4.26 | 22.41 | 46.95 | 34.43 |
| Industrial Thermal Source | 1.54 | 5.21 | 25.96 | 60.38 | 45.98 |
| Mining Activity | 21.07 | 54.20 | 1.80 | 42.25 | 42.41 |
| Wildfire | 37.61 | 85.10 | 67.76 | 1.99 | 26.69 |

### Analysis:
- **Mining Activity**: Very low mine_proximity_km (mean ~0.6 km) - **STRONG LEAKAGE**
- **Wildfire**: Very low forest_proximity_km (mean ~0.8 km) - **STRONG LEAKAGE**
- **Agricultural Burning**: Very low cropland_proximity_km (mean ~0.9 km) - **STRONG LEAKAGE**
- **Industrial Fire**: Low industrial_proximity_km (mean ~1.8 km) - **LEAKAGE**
- **Gas Flare**: Low refinery_proximity_km (mean ~1.2 km) - **LEAKAGE**
- **Industrial Thermal Source**: Low industrial_proximity_km (mean ~3.5 km) - **LEAKAGE**

**CONCLUSION**: The proximity features were generated using the label as a conditioning variable.
In a real deployment, these proximities would be computed from actual geospatial data (OSM, land cover)
WITHOUT knowledge of the event type. This creates an unrealistic classification scenario.

## 6. Land Cover by Class
| label                     |   Bare Land |   Built-up |   Cropland |   Forest |   Grassland |   Industrial |   Mining |   Shrubland |
|:--------------------------|------------:|-----------:|-----------:|---------:|------------:|-------------:|---------:|------------:|
| Agricultural Burning      |        33.6 |        0   |       32.6 |      0   |        33.8 |          0   |      0   |         0   |
| Gas Flare                 |        51.6 |        0   |        0   |      0   |         0   |         48.4 |      0   |         0   |
| Industrial Fire           |        33   |       33.8 |        0   |      0   |         0   |         33.2 |      0   |         0   |
| Industrial Thermal Source |         0   |       50.2 |        0   |      0   |         0   |         49.8 |      0   |         0   |
| Mining Activity           |        33.6 |        0   |        0   |      0   |         0   |         32.9 |     33.6 |         0   |
| Wildfire                  |        26.2 |        0   |        0   |     25.1 |        24.2 |          0   |      0   |        24.6 |

## 7. Feature-Target Correlation (Point-Biserial for each class)

### Class: Agricultural Burning
| Feature | Correlation |
|---------|-------------|
| brightness_k | -0.2774 |
| frp_mw | -0.1583 |
| firms_confidence_pct | 0.0102 |
| daynight | -0.4599 |
| observation_count_7d | -0.4347 |
| persistence_hours_7d | -0.5853 |
| frp_trend_pct | -0.0899 |
| industrial_proximity_km | 0.1021 |
| refinery_proximity_km | 0.2388 |
| mine_proximity_km | 0.3115 |
| forest_proximity_km | -0.0484 |
| cropland_proximity_km | -0.5177 |
| population_5km | -0.1423 |

### Class: Gas Flare
| Feature | Correlation |
|---------|-------------|
| brightness_k | 0.2454 |
| frp_mw | 0.2489 |
| firms_confidence_pct | -0.0034 |
| daynight | 0.1928 |
| observation_count_7d | 0.6129 |
| persistence_hours_7d | 0.3570 |
| frp_trend_pct | -0.3486 |
| industrial_proximity_km | -0.3124 |
| refinery_proximity_km | -0.3653 |
| mine_proximity_km | 0.1306 |
| forest_proximity_km | 0.5529 |
| cropland_proximity_km | 0.6221 |
| population_5km | -0.1619 |

### Class: Industrial Fire
| Feature | Correlation |
|---------|-------------|
| brightness_k | 0.2311 |
| frp_mw | 0.0807 |
| firms_confidence_pct | 0.0056 |
| daynight | 0.1537 |
| observation_count_7d | -0.3104 |
| persistence_hours_7d | -0.2249 |
| frp_trend_pct | 0.3341 |
| industrial_proximity_km | -0.3315 |
| refinery_proximity_km | -0.3508 |
| mine_proximity_km | -0.2187 |
| forest_proximity_km | -0.0084 |
| cropland_proximity_km | -0.0665 |
| population_5km | 0.2202 |

### Class: Industrial Thermal Source
| Feature | Correlation |
|---------|-------------|
| brightness_k | 0.0068 |
| frp_mw | -0.0881 |
| firms_confidence_pct | -0.0129 |
| daynight | 0.1820 |
| observation_count_7d | 0.1938 |
| persistence_hours_7d | 0.1914 |
| frp_trend_pct | -0.1856 |
| industrial_proximity_km | -0.3265 |
| refinery_proximity_km | -0.3397 |
| mine_proximity_km | -0.1644 |
| forest_proximity_km | 0.1662 |
| cropland_proximity_km | 0.0919 |
| population_5km | 0.4278 |

### Class: Mining Activity
| Feature | Correlation |
|---------|-------------|
| brightness_k | -0.0805 |
| frp_mw | -0.0868 |
| firms_confidence_pct | -0.0041 |
| daynight | 0.0069 |
| observation_count_7d | -0.0826 |
| persistence_hours_7d | 0.1450 |
| frp_trend_pct | -0.0964 |
| industrial_proximity_km | 0.2078 |
| refinery_proximity_km | 0.2291 |
| mine_proximity_km | -0.5337 |
| forest_proximity_km | -0.0695 |
| cropland_proximity_km | 0.0429 |
| population_5km | -0.1718 |

### Class: Wildfire
| Feature | Correlation |
|---------|-------------|
| brightness_k | -0.1254 |
| frp_mw | 0.0036 |
| firms_confidence_pct | 0.0045 |
| daynight | -0.0755 |
| observation_count_7d | 0.0210 |
| persistence_hours_7d | 0.1168 |
| frp_trend_pct | 0.3863 |
| industrial_proximity_km | 0.6605 |
| refinery_proximity_km | 0.5879 |
| mine_proximity_km | 0.4746 |
| forest_proximity_km | -0.5928 |
| cropland_proximity_km | -0.1727 |
| population_5km | -0.1719 |

## 8. Recommendations
### CRITICAL: Target Leakage Detected
The geospatial proximity features (**industrial_proximity_km, refinery_proximity_km, mine_proximity_km, forest_proximity_km, cropland_proximity_km**) show perfect or near-perfect separation for their corresponding classes.

**These features MUST NOT be used as-is in a production model** because:
1. They were generated using label information (data leakage)
2. In production, proximities are computed from OSM/geospatial data WITHOUT knowing the event type
3. Real proximities would have noise, errors, and overlap between classes

### Options for Modeling:
1. **Option A (Realistic)**: Use ONLY thermal + temporal features (brightness_k, frp_mw, firms_confidence_pct, daynight, observation_count_7d, persistence_hours_7d, frp_trend_pct) + land_cover + population_5km
2. **Option B (Ablation)**: Compare models with and without proximity features to quantify leakage impact
3. **Option C (Noisy Proximity)**: Add synthetic noise to proximity features to simulate real-world uncertainty
4. **Option D (Feature Engineering)**: Use proximity features but with realistic noise/injection

### RECOMMENDED APPROACH FOR THIS PROJECT:
**Use Option B (Ablation)** as the primary evaluation strategy:
- Model A: Thermal features only
- Model B: Thermal + temporal features
- Model C: Thermal + temporal + geospatial (current proximity features)
- This demonstrates the value of contextual enrichment while being honest about leakage
- For production deployment, only Models A/B would be viable until real proximity data is available
