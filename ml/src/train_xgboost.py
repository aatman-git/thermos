import pandas as pd
import numpy as np
import pickle
import json
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import xgboost as xgb
import warnings
warnings.filterwarnings('ignore')

PROJECT_ROOT = Path(__file__).parents[2]
DATA_PATH = PROJECT_ROOT / "ml" / "data" / "processed" / "thermos_clean.csv"
MODEL_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODEL_DIR / "xgboost_classifier.pkl"
ENCODERS_PATH = MODEL_DIR / "label_encoders.pkl"
METADATA_PATH = MODEL_DIR / "model_metadata.json"

def main():
    print("=" * 60)
    print("TRAINING XGBOOST CLASSIFICATION MODEL")
    print("=" * 60)
    
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")
    
    feature_cols = [c for c in df.columns if c != 'label']
    X = df[feature_cols].copy()
    y = df['label'].copy()
    
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    le_land_cover = LabelEncoder()
    X['land_cover'] = le_land_cover.fit_transform(X['land_cover'])
    
    le_daynight = LabelEncoder()
    X['daynight'] = le_daynight.fit_transform(X['daynight'])
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )
    
    print(f"Train size: {X_train.shape[0]}, Test size: {X_test.shape[0]}")
    print(f"Classes: {label_encoder.classes_}")
    
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        eval_metric='mlogloss',
        use_label_encoder=False
    )
    
    print("\nTraining model...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )
    
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)
    
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nTest Accuracy: {accuracy:.4f}")
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=label_encoder.classes_))
    
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    print(f"\nModel saved to: {MODEL_PATH}")
    
    encoders = {
        'label_encoder': label_encoder,
        'land_cover_encoder': le_land_cover,
        'daynight_encoder': le_daynight
    }
    with open(ENCODERS_PATH, 'wb') as f:
        pickle.dump(encoders, f)
    print(f"Encoders saved to: {ENCODERS_PATH}")
    
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    metadata = {
        'model_type': 'XGBoost Classifier',
        'n_classes': len(label_encoder.classes_),
        'classes': label_encoder.classes_.tolist(),
        'n_features': len(feature_cols),
        'features': feature_cols,
        'feature_importance': feature_importance.to_dict('records'),
        'test_accuracy': float(accuracy),
        'hyperparameters': {
            'n_estimators': 200,
            'max_depth': 6,
            'learning_rate': 0.1,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'random_state': 42
        },
        'train_samples': int(X_train.shape[0]),
        'test_samples': int(X_test.shape[0])
    }
    
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to: {METADATA_PATH}")
    
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    
    return model, encoders, metadata

if __name__ == "__main__":
    model, encoders, metadata = main()