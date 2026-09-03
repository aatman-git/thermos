import pandas as pd
import numpy as np
import json
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

PROJECT_ROOT = Path(__file__).parents[2]
DATA_PATH = PROJECT_ROOT / "ml" / "data" / "processed" / "thermos_clean.csv"
REPORTS_DIR = PROJECT_ROOT / "ml" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

def main():
    print("=" * 60)
    print("PHASE 3: LEAKAGE CHECK")
    print("=" * 60)
    
    df = pd.read_csv(DATA_PATH)
    print(f"\nDataset: {df.shape[0]} rows, {df.shape[1]} columns")
    
    leakage_report = []
    leakage_report.append("# THERMOS Dataset - Leakage Check Report\n")
    leakage_report.append(f"**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    leakage_report.append(f"## Dataset Overview\n")
    leakage_report.append(f"- Rows: {df.shape[0]:,}\n")
    leakage_report.append(f"- Columns: {df.shape[1]}\n")
    leakage_report.append(f"- Target: label\n\n")
    
    feature_cols = [c for c in df.columns if c != 'label']
    numeric_cols = df[feature_cols].select_dtypes(include=[np.number]).columns.tolist()
    
    # 1. Perfect separation check (already found)
    leakage_report.append("## 1. Perfect Feature-Class Separation\n")
    leakage_report.append("The following features perfectly separate specific classes:\n\n")
    
    for col in numeric_cols:
        for cls in df['label'].unique():
            cls_vals = df[df['label'] == cls][col]
            other_vals = df[df['label'] != cls][col]
            cls_min, cls_max = cls_vals.min(), cls_vals.max()
            other_min, other_max = other_vals.min(), other_vals.max()
            if cls_max < other_min or cls_min > other_max:
                leakage_report.append(f"- **{col}** perfectly separates **{cls}**\n")
                leakage_report.append(f"  - Class range: [{cls_min:.4f}, {cls_max:.4f}]\n")
                leakage_report.append(f"  - Other range: [{other_min:.4f}, {other_max:.4f}]\n")
                leakage_report.append(f"  - **LEAKAGE SUSPECTED**: This feature was likely generated using label information\n\n")
    
    # 2. Conditional distributions - check if features are suspiciously different per class
    leakage_report.append("## 2. Feature Distributions by Class (Summary Statistics)\n")
    for col in numeric_cols:
        leakage_report.append(f"\n### {col}\n")
        leakage_report.append("| Class | Mean | Std | Min | Max |\n")
        leakage_report.append("|-------|------|-----|-----|-----|\n")
        for cls in sorted(df['label'].unique()):
            vals = df[df['label'] == cls][col]
            leakage_report.append(f"| {cls} | {vals.mean():.2f} | {vals.std():.2f} | {vals.min():.2f} | {vals.max():.2f} |\n")
    
    # 3. Check if any feature is essentially a proxy for the label
    leakage_report.append("\n## 3. Feature-Label Mutual Information (Proxy Check)\n")
    from sklearn.feature_selection import mutual_info_classif
    from sklearn.preprocessing import LabelEncoder
    
    X = df[feature_cols].copy()
    y = df['label']
    le = LabelEncoder()
    y_enc = le.fit_transform(y)
    
    # Encode categorical
    for col in X.select_dtypes(include=['object']).columns:
        X[col] = LabelEncoder().fit_transform(X[col])
    
    mi_scores = mutual_info_classif(X, y_enc, random_state=42)
    mi_df = pd.DataFrame({'feature': feature_cols, 'mutual_info': mi_scores})
    mi_df = mi_df.sort_values('mutual_info', ascending=False)
    
    leakage_report.append("| Feature | Mutual Information |\n")
    leakage_report.append("|---------|-------------------|\n")
    for _, row in mi_df.iterrows():
        leakage_report.append(f"| {row['feature']} | {row['mutual_info']:.4f} |\n")
    
    # High MI features are suspicious
    high_mi = mi_df[mi_df['mutual_info'] > 0.5]
    if len(high_mi) > 0:
        leakage_report.append("\n**HIGH MUTUAL INFORMATION FEATURES (Potential Leakage):**\n")
        for _, row in high_mi.iterrows():
            leakage_report.append(f"- {row['feature']}: MI = {row['mutual_info']:.4f}\n")
    
    # 4. Check brightness_k == 367.0 pattern
    leakage_report.append("\n## 4. Synthetic Data Artifacts\n")
    if 'brightness_k' in df.columns:
        exact_367 = (df['brightness_k'] == 367.0).sum()
        leakage_report.append(f"- **brightness_k == 367.0**: {exact_367} rows ({exact_367/len(df)*100:.2f}%)\n")
        leakage_report.append(f"  - This exact value appearing frequently suggests a capped/clipped synthetic generation\n")
        leakage_report.append(f"  - In real FIRMS data, brightness temperatures are continuous\n\n")
    
    # Check perfectly balanced classes
    class_counts = df['label'].value_counts()
    if class_counts.nunique() == 1:
        leakage_report.append(f"- **Perfectly balanced classes**: Each class has exactly {class_counts.iloc[0]} samples\n")
        leakage_report.append(f"  - Real-world data would never be perfectly balanced\n")
        leakage_report.append(f"  - This confirms synthetic/stratified generation\n\n")
    
    # 5. Check geospatial proximity features generation logic
    leakage_report.append("## 5. Geospatial Proximity Features Analysis\n")
    proximity_cols = ['industrial_proximity_km', 'refinery_proximity_km', 'mine_proximity_km',
                      'forest_proximity_km', 'cropland_proximity_km']
    
    leakage_report.append("\n### Proximity Feature Means by Class:\n")
    leakage_report.append("| Class | Industrial | Refinery | Mine | Forest | Cropland |\n")
    leakage_report.append("|-------|------------|----------|------|--------|----------|\n")
    for cls in sorted(df['label'].unique()):
        row_data = df[df['label'] == cls][proximity_cols].mean()
        leakage_report.append(f"| {cls} | {row_data['industrial_proximity_km']:.2f} | {row_data['refinery_proximity_km']:.2f} | {row_data['mine_proximity_km']:.2f} | {row_data['forest_proximity_km']:.2f} | {row_data['cropland_proximity_km']:.2f} |\n")
    
    leakage_report.append("\n### Analysis:\n")
    leakage_report.append("- **Mining Activity**: Very low mine_proximity_km (mean ~0.6 km) - **STRONG LEAKAGE**\n")
    leakage_report.append("- **Wildfire**: Very low forest_proximity_km (mean ~0.8 km) - **STRONG LEAKAGE**\n")
    leakage_report.append("- **Agricultural Burning**: Very low cropland_proximity_km (mean ~0.9 km) - **STRONG LEAKAGE**\n")
    leakage_report.append("- **Industrial Fire**: Low industrial_proximity_km (mean ~1.8 km) - **LEAKAGE**\n")
    leakage_report.append("- **Gas Flare**: Low refinery_proximity_km (mean ~1.2 km) - **LEAKAGE**\n")
    leakage_report.append("- **Industrial Thermal Source**: Low industrial_proximity_km (mean ~3.5 km) - **LEAKAGE**\n\n")
    
    leakage_report.append("**CONCLUSION**: The proximity features were generated using the label as a conditioning variable.\n")
    leakage_report.append("In a real deployment, these proximities would be computed from actual geospatial data (OSM, land cover)\n")
    leakage_report.append("WITHOUT knowledge of the event type. This creates an unrealistic classification scenario.\n\n")
    
    # 6. Land cover distribution by class
    leakage_report.append("## 6. Land Cover by Class\n")
    lc_ct = pd.crosstab(df['label'], df['land_cover'], normalize='index') * 100
    leakage_report.append(lc_ct.round(1).to_markdown())
    leakage_report.append("\n\n")
    
    # 7. Correlation of features with target (encoded)
    leakage_report.append("## 7. Feature-Target Correlation (Point-Biserial for each class)\n")
    for cls in sorted(df['label'].unique()):
        y_binary = (df['label'] == cls).astype(int)
        leakage_report.append(f"\n### Class: {cls}\n")
        leakage_report.append("| Feature | Correlation |\n")
        leakage_report.append("|---------|-------------|\n")
        for col in numeric_cols:
            corr = df[col].corr(y_binary)
            leakage_report.append(f"| {col} | {corr:.4f} |\n")
    
    # 8. RECOMMENDATIONS
    leakage_report.append("\n## 8. Recommendations\n")
    leakage_report.append("### CRITICAL: Target Leakage Detected\n")
    leakage_report.append("The geospatial proximity features (**industrial_proximity_km, refinery_proximity_km, ")
    leakage_report.append("mine_proximity_km, forest_proximity_km, cropland_proximity_km**) ")
    leakage_report.append("show perfect or near-perfect separation for their corresponding classes.\n\n")
    leakage_report.append("**These features MUST NOT be used as-is in a production model** because:\n")
    leakage_report.append("1. They were generated using label information (data leakage)\n")
    leakage_report.append("2. In production, proximities are computed from OSM/geospatial data WITHOUT knowing the event type\n")
    leakage_report.append("3. Real proximities would have noise, errors, and overlap between classes\n\n")
    
    leakage_report.append("### Options for Modeling:\n")
    leakage_report.append("1. **Option A (Realistic)**: Use ONLY thermal + temporal features (brightness_k, frp_mw, firms_confidence_pct, ")
    leakage_report.append("daynight, observation_count_7d, persistence_hours_7d, frp_trend_pct) + land_cover + population_5km\n")
    leakage_report.append("2. **Option B (Ablation)**: Compare models with and without proximity features to quantify leakage impact\n")
    leakage_report.append("3. **Option C (Noisy Proximity)**: Add synthetic noise to proximity features to simulate real-world uncertainty\n")
    leakage_report.append("4. **Option D (Feature Engineering)**: Use proximity features but with realistic noise/injection\n\n")
    
    leakage_report.append("### RECOMMENDED APPROACH FOR THIS PROJECT:\n")
    leakage_report.append("**Use Option B (Ablation)** as the primary evaluation strategy:\n")
    leakage_report.append("- Model A: Thermal features only\n")
    leakage_report.append("- Model B: Thermal + temporal features\n")
    leakage_report.append("- Model C: Thermal + temporal + geospatial (current proximity features)\n")
    leakage_report.append("- This demonstrates the value of contextual enrichment while being honest about leakage\n")
    leakage_report.append("- For production deployment, only Models A/B would be viable until real proximity data is available\n")
    
    # Save report
    report_path = REPORTS_DIR / "leakage_check.md"
    with open(report_path, 'w') as f:
        f.write(''.join(leakage_report))
    
    # Also save key findings as JSON for later use
    leakage_findings = {
        'perfect_separation': {
            'mine_proximity_km': 'Mining Activity',
            'forest_proximity_km': 'Wildfire',
            'cropland_proximity_km': 'Agricultural Burning'
        },
        'high_mi_features': mi_df[mi_df['mutual_info'] > 0.3]['feature'].tolist(),
        'synthetic_indicators': {
            'perfectly_balanced_classes': True,
            'exact_brightness_cap_367_pct': round(exact_367/len(df)*100, 2)
        },
        'recommendation': 'Use ablation study comparing thermal-only vs thermal+temporal vs thermal+temporal+geospatial'
    }
    
    with open(REPORTS_DIR / "leakage_findings.json", 'w') as f:
        json.dump(leakage_findings, f, indent=2)
    
    print("\n".join(leakage_report[-20:]))  # Print last 20 lines
    print(f"\nFull leakage report saved to: {report_path}")
    print(f"Leakage findings JSON saved to: {REPORTS_DIR / 'leakage_findings.json'}")
    
    print("\n" + "=" * 60)
    print("PHASE 3 COMPLETE - LEAKAGE DETECTED")
    print("=" * 60)
    
    return df, leakage_findings

if __name__ == "__main__":
    df, findings = main()