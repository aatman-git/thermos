import pandas as pd
import numpy as np
import json
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

PROJECT_ROOT = Path(__file__).parents[2]
DATA_PATH = PROJECT_ROOT / "ml" / "data" / "raw" / "THERMOS_ML_Core_15_Columns.csv"
REPORTS_DIR = PROJECT_ROOT / "ml" / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"
PROCESSED_DIR = PROJECT_ROOT / "ml" / "data" / "processed"

for d in [REPORTS_DIR, FIGURES_DIR, PROCESSED_DIR]:
    d.mkdir(parents=True, exist_ok=True)

plt.style.use('seaborn-v0_8-whitegrid')
sns.set_palette("husl")

def main():
    print("=" * 60)
    print("PHASE 1: DATA AUDIT")
    print("=" * 60)
    
    df = pd.read_csv(DATA_PATH)
    print(f"\nDataset loaded: {df.shape[0]} rows, {df.shape[1]} columns")
    
    # Basic info
    audit_results = {}
    audit_results['row_count'] = int(df.shape[0])
    audit_results['column_count'] = int(df.shape[1])
    audit_results['columns'] = list(df.columns)
    audit_results['dtypes'] = {col: str(dtype) for col, dtype in df.dtypes.items()}
    
    # Unique classes and distribution
    audit_results['unique_classes'] = sorted(df['label'].unique().tolist())
    audit_results['class_distribution'] = df['label'].value_counts().to_dict()
    audit_results['class_distribution_pct'] = (df['label'].value_counts(normalize=True) * 100).round(2).to_dict()
    
    # Missing values
    audit_results['missing_values'] = df.isnull().sum().to_dict()
    audit_results['missing_pct'] = (df.isnull().sum() / len(df) * 100).round(2).to_dict()
    
    # Duplicate rows
    audit_results['duplicate_rows'] = int(df.duplicated().sum())
    audit_results['duplicate_rows_pct'] = round(df.duplicated().sum() / len(df) * 100, 2)
    
    # Numeric columns statistics
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    audit_results['numeric_columns'] = numeric_cols
    audit_results['numeric_stats'] = {}
    for col in numeric_cols:
        stats = df[col].describe()
        audit_results['numeric_stats'][col] = {
            'min': float(stats['min']),
            'max': float(stats['max']),
            'mean': float(stats['mean']),
            'median': float(df[col].median()),
            'std': float(stats['std']),
            'q25': float(stats['25%']),
            'q75': float(stats['75%']),
            'skew': float(df[col].skew()),
            'kurtosis': float(df[col].kurtosis())
        }
    
    # Categorical columns
    categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
    audit_results['categorical_columns'] = categorical_cols
    audit_results['categorical_unique'] = {}
    for col in categorical_cols:
        audit_results['categorical_unique'][col] = df[col].nunique()
        audit_results[f'{col}_values'] = df[col].value_counts().to_dict()
    
    # Suspicious values
    audit_results['suspicious_values'] = {}
    for col in numeric_cols:
        neg_count = (df[col] < 0).sum()
        if neg_count > 0:
            audit_results['suspicious_values'][f'{col}_negative'] = int(neg_count)
        inf_count = np.isinf(df[col]).sum()
        if inf_count > 0:
            audit_results['suspicious_values'][f'{col}_infinite'] = int(inf_count)
        zero_count = (df[col] == 0).sum()
        if zero_count > 0:
            audit_results['suspicious_values'][f'{col}_zero'] = int(zero_count)
    
    # Impossible values check
    impossible = {}
    if 'brightness_k' in df.columns:
        impossible['brightness_k_lt_0'] = int((df['brightness_k'] < 0).sum())
        impossible['brightness_k_gt_1000'] = int((df['brightness_k'] > 1000).sum())
    if 'frp_mw' in df.columns:
        impossible['frp_mw_lt_0'] = int((df['frp_mw'] < 0).sum())
    if 'firms_confidence_pct' in df.columns:
        impossible['confidence_lt_0'] = int((df['firms_confidence_pct'] < 0).sum())
        impossible['confidence_gt_100'] = int((df['firms_confidence_pct'] > 100).sum())
    if 'daynight' in df.columns:
        impossible['daynight_not_binary'] = int(~df['daynight'].isin([0, 1]).sum())
    if 'observation_count_7d' in df.columns:
        impossible['obs_count_lt_0'] = int((df['observation_count_7d'] < 0).sum())
    if 'persistence_hours_7d' in df.columns:
        impossible['persistence_lt_0'] = int((df['persistence_hours_7d'] < 0).sum())
        impossible['persistence_gt_168'] = int((df['persistence_hours_7d'] > 168).sum())
    if 'frp_trend_pct' in df.columns:
        impossible['frp_trend_lt_neg100'] = int((df['frp_trend_pct'] < -100).sum())
    if 'population_5km' in df.columns:
        impossible['pop_lt_0'] = int((df['population_5km'] < 0).sum())
    audit_results['impossible_values'] = impossible
    
    # Correlation matrix for numeric features
    corr_matrix = df[numeric_cols].corr()
    audit_results['correlation_matrix'] = corr_matrix.round(4).to_dict()
    
    # High correlations
    high_corr = []
    for i in range(len(numeric_cols)):
        for j in range(i+1, len(numeric_cols)):
            corr = corr_matrix.iloc[i, j]
            if abs(corr) > 0.9:
                high_corr.append({
                    'feature1': numeric_cols[i],
                    'feature2': numeric_cols[j],
                    'correlation': round(corr, 4)
                })
    audit_results['high_correlations'] = high_corr
    
    # Save audit results as JSON
    audit_json_path = REPORTS_DIR / "data_audit.json"
    with open(audit_json_path, 'w') as f:
        json.dump(audit_results, f, indent=2, default=str)
    print(f"\nAudit JSON saved to: {audit_json_path}")
    
    # Create CSV summary
    summary_rows = []
    for col in df.columns:
        row = {
            'column': col,
            'dtype': str(df[col].dtype),
            'missing': int(df[col].isnull().sum()),
            'missing_pct': round(df[col].isnull().sum() / len(df) * 100, 2),
            'unique': int(df[col].nunique())
        }
        if col in numeric_cols:
            row['min'] = float(df[col].min())
            row['max'] = float(df[col].max())
            row['mean'] = float(df[col].mean())
            row['median'] = float(df[col].median())
            row['std'] = float(df[col].std())
        summary_rows.append(row)
    
    summary_df = pd.DataFrame(summary_rows)
    summary_csv_path = REPORTS_DIR / "data_audit.csv"
    summary_df.to_csv(summary_csv_path, index=False)
    print(f"Summary CSV saved to: {summary_csv_path}")
    
    # Create markdown report
    md_path = REPORTS_DIR / "data_audit.md"
    with open(md_path, 'w') as f:
        f.write("# THERMOS Dataset - Data Audit Report\n\n")
        f.write(f"**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"## Dataset Overview\n\n")
        f.write(f"- **Rows:** {audit_results['row_count']:,}\n")
        f.write(f"- **Columns:** {audit_results['column_count']}\n")
        f.write(f"- **Features:** {audit_results['column_count'] - 1} (excluding target)\n")
        f.write(f"- **Target:** label\n\n")
        
        f.write(f"## Class Distribution\n\n")
        f.write("| Class | Count | Percentage |\n")
        f.write("|-------|-------|------------|\n")
        for cls in audit_results['unique_classes']:
            cnt = audit_results['class_distribution'][cls]
            pct = audit_results['class_distribution_pct'][cls]
            f.write(f"| {cls} | {cnt:,} | {pct:.2f}% |\n")
        f.write("\n")
        
        f.write(f"## Data Types\n\n")
        for col, dtype in audit_results['dtypes'].items():
            f.write(f"- **{col}**: {dtype}\n")
        f.write("\n")
        
        f.write(f"## Missing Values\n\n")
        missing_any = False
        for col, miss in audit_results['missing_values'].items():
            if miss > 0:
                f.write(f"- **{col}**: {miss} ({audit_results['missing_pct'][col]}%)\n")
                missing_any = True
        if not missing_any:
            f.write("No missing values found.\n")
        f.write("\n")
        
        f.write(f"## Duplicate Rows\n\n")
        f.write(f"- **Total duplicates:** {audit_results['duplicate_rows']} ({audit_results['duplicate_rows_pct']}%)\n\n")
        
        f.write(f"## Numeric Feature Statistics\n\n")
        for col in numeric_cols:
            stats = audit_results['numeric_stats'][col]
            f.write(f"### {col}\n")
            f.write(f"- Min: {stats['min']:.4f}\n")
            f.write(f"- Max: {stats['max']:.4f}\n")
            f.write(f"- Mean: {stats['mean']:.4f}\n")
            f.write(f"- Median: {stats['median']:.4f}\n")
            f.write(f"- Std: {stats['std']:.4f}\n")
            f.write(f"- Skew: {stats['skew']:.4f}\n")
            f.write(f"- Kurtosis: {stats['kurtosis']:.4f}\n\n")
        
        f.write(f"## Categorical Features\n\n")
        for col in categorical_cols:
            f.write(f"### {col} ({audit_results['categorical_unique'][col]} unique values)\n")
            for val, cnt in audit_results[f'{col}_values'].items():
                pct = cnt / len(df) * 100
                f.write(f"- {val}: {cnt:,} ({pct:.2f}%)\n")
            f.write("\n")
        
        f.write(f"## Suspicious Values\n\n")
        for key, val in audit_results['suspicious_values'].items():
            f.write(f"- **{key}**: {val}\n")
        f.write("\n")
        
        f.write(f"## Impossible Values Check\n\n")
        for key, val in audit_results['impossible_values'].items():
            f.write(f"- **{key}**: {val}\n")
        f.write("\n")
        
        f.write(f"## High Correlations (|r| > 0.9)\n\n")
        if high_corr:
            for hc in high_corr:
                f.write(f"- **{hc['feature1']}** vs **{hc['feature2']}**: {hc['correlation']:.4f}\n")
        else:
            f.write("No correlations > 0.9 found.\n")
        f.write("\n")
        
        f.write(f"## Notes\n\n")
        f.write("- This dataset appears to be synthetic/development data.\n")
        f.write("- Metrics from this data should NOT be claimed as real-world NASA/NTRO performance.\n")
        f.write("- All preprocessing and modeling decisions are documented for reproducibility.\n")
    
    print(f"Markdown report saved to: {md_path}")
    
    # ==================== VISUALIZATIONS ====================
    print("\nGenerating visualizations...")
    
    # 1. Class distribution
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Count plot
    class_counts = df['label'].value_counts()
    axes[0].bar(range(len(class_counts)), class_counts.values, color=sns.color_palette("husl", len(class_counts)))
    axes[0].set_xticks(range(len(class_counts)))
    axes[0].set_xticklabels(class_counts.index, rotation=45, ha='right')
    axes[0].set_title('Class Distribution (Count)')
    axes[0].set_ylabel('Count')
    for i, v in enumerate(class_counts.values):
        axes[0].text(i, v + max(class_counts.values)*0.01, f'{v:,}', ha='center', va='bottom', fontsize=9)
    
    # Percentage plot
    class_pct = df['label'].value_counts(normalize=True) * 100
    axes[1].bar(range(len(class_pct)), class_pct.values, color=sns.color_palette("husl", len(class_pct)))
    axes[1].set_xticks(range(len(class_pct)))
    axes[1].set_xticklabels(class_pct.index, rotation=45, ha='right')
    axes[1].set_title('Class Distribution (Percentage)')
    axes[1].set_ylabel('Percentage')
    for i, v in enumerate(class_pct.values):
        axes[1].text(i, v + max(class_pct.values)*0.01, f'{v:.1f}%', ha='center', va='bottom', fontsize=9)
    
    plt.tight_layout()
    plt.savefig(FIGURES_DIR / "class_distribution.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 2. Numeric feature distributions
    n_numeric = len(numeric_cols)
    n_cols = 4
    n_rows = (n_numeric + n_cols - 1) // n_cols
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(16, 4*n_rows))
    axes = axes.flatten()
    
    for i, col in enumerate(numeric_cols):
        axes[i].hist(df[col], bins=50, alpha=0.7, edgecolor='black', density=True)
        axes[i].set_title(f'{col}')
        axes[i].set_xlabel('Value')
        axes[i].set_ylabel('Density')
    
    for i in range(n_numeric, len(axes)):
        axes[i].set_visible(False)
    
    plt.tight_layout()
    plt.savefig(FIGURES_DIR / "numeric_distributions.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 3. Correlation matrix
    plt.figure(figsize=(14, 12))
    mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
    sns.heatmap(corr_matrix, mask=mask, annot=True, fmt='.2f', cmap='RdBu_r', 
                center=0, square=True, linewidths=0.5, cbar_kws={'shrink': 0.8})
    plt.title('Feature Correlation Matrix', fontsize=16)
    plt.tight_layout()
    plt.savefig(FIGURES_DIR / "correlation_matrix.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 4. Boxplots for numeric features by class
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(16, 4*n_rows))
    axes = axes.flatten()
    
    for i, col in enumerate(numeric_cols):
        df.boxplot(column=col, by='label', ax=axes[i], grid=False)
        axes[i].set_title(f'{col} by Class')
        axes[i].set_xlabel('')
        plt.sca(axes[i])
        plt.xticks(rotation=45, ha='right')
    
    for i in range(n_numeric, len(axes)):
        axes[i].set_visible(False)
    
    plt.suptitle('')
    plt.tight_layout()
    plt.savefig(FIGURES_DIR / "boxplots_by_class.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 5. Feature distributions by class (violin plots for key features)
    key_features = ['brightness_k', 'frp_mw', 'persistence_hours_7d', 'industrial_proximity_km', 
                    'refinery_proximity_km', 'mine_proximity_km', 'forest_proximity_km', 'cropland_proximity_km']
    key_features = [f for f in key_features if f in numeric_cols]
    
    n_key = len(key_features)
    n_cols = 4
    n_rows = (n_key + n_cols - 1) // n_cols
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(16, 4*n_rows))
    axes = axes.flatten()
    
    for i, col in enumerate(key_features):
        sns.violinplot(data=df, x='label', y=col, ax=axes[i], inner='quartile')
        axes[i].set_title(f'{col} by Class')
        axes[i].set_xlabel('')
        plt.sca(axes[i])
        plt.xticks(rotation=45, ha='right')
    
    for i in range(n_key, len(axes)):
        axes[i].set_visible(False)
    
    plt.tight_layout()
    plt.savefig(FIGURES_DIR / "violin_key_features.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 6. Pairplot for key thermal features (sampled for speed)
    sample_df = df.sample(n=min(2000, len(df)), random_state=42)
    key_thermal = ['brightness_k', 'frp_mw', 'firms_confidence_pct', 'persistence_hours_7d', 'frp_trend_pct']
    key_thermal = [f for f in key_thermal if f in sample_df.columns]
    
    if len(key_thermal) > 1:
        g = sns.pairplot(sample_df[key_thermal + ['label']], hue='label', diag_kind='kde', 
                         plot_kws={'alpha': 0.5, 's': 10}, height=2)
        g.fig.suptitle('Pairplot of Key Thermal Features (Sampled)', y=1.02)
        plt.savefig(FIGURES_DIR / "pairplot_thermal.png", dpi=150, bbox_inches='tight')
        plt.close()
    
    print(f"All visualizations saved to: {FIGURES_DIR}")
    print("\n" + "=" * 60)
    print("PHASE 1 COMPLETE")
    print("=" * 60)
    
    return df, audit_results

if __name__ == "__main__":
    df, audit = main()