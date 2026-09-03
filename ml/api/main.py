from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from typing import List
import pickle
import json
import numpy as np
import pandas as pd
from pathlib import Path

app = FastAPI(title="THERMOS XGBoost Classifier API", version="1.0.0")

MODEL_DIR = Path(__file__).parent.parent / "models"
MODEL_PATH = MODEL_DIR / "xgboost_classifier.pkl"
ENCODERS_PATH = MODEL_DIR / "label_encoders.pkl"
METADATA_PATH = MODEL_DIR / "model_metadata.json"

model = None
encoders = None
metadata = None
feature_cols = None


@app.on_event("startup")
async def load_model():
    global model, encoders, metadata, feature_cols
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    with open(ENCODERS_PATH, "rb") as f:
        encoders = pickle.load(f)
    with open(METADATA_PATH, "r") as f:
        metadata = json.load(f)
    feature_cols = metadata["features"]
    print("Model and encoders loaded successfully")


class PredictionInput(BaseModel):
    brightness_k: float = Field(..., ge=200, le=500, description="Brightness temperature in Kelvin")
    frp_mw: float = Field(..., ge=0, le=5000, description="Fire Radiative Power in MW")
    firms_confidence_pct: int = Field(..., ge=0, le=100, description="FIRMS confidence percentage")
    daynight: str = Field(..., description="Day (D) or Night (N)")
    observation_count_7d: int = Field(..., ge=0, le=100, description="Observation count in 7 days")
    persistence_hours_7d: float = Field(..., ge=0, le=168, description="Persistence hours in 7 days")
    frp_trend_pct: float = Field(..., ge=-100, le=500, description="FRP trend percentage")
    industrial_proximity_km: float = Field(..., ge=0, description="Distance to industrial area (km)")
    refinery_proximity_km: float = Field(..., ge=0, description="Distance to refinery (km)")
    mine_proximity_km: float = Field(..., ge=0, description="Distance to mine (km)")
    forest_proximity_km: float = Field(..., ge=0, description="Distance to forest (km)")
    cropland_proximity_km: float = Field(..., ge=0, description="Distance to cropland (km)")
    population_5km: int = Field(..., ge=0, description="Population within 5km")
    land_cover: str = Field(..., description="Land cover type")


class PredictionOutput(BaseModel):
    predicted_class: str
    confidence: float
    all_probabilities: dict


@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open(Path(__file__).parent / "static" / "index.html", "r") as f:
        return f.read()


@app.get("/api/classes")
async def get_classes():
    return {"classes": metadata["classes"]}


@app.get("/api/land_cover_types")
async def get_land_cover_types():
    return {"land_cover_types": encoders["land_cover_encoder"].classes_.tolist()}


@app.get("/api/feature_info")
async def get_feature_info():
    return {
        "features": feature_cols,
        "categorical_features": {
            "daynight": [0, 1],
            "land_cover": encoders["land_cover_encoder"].classes_.tolist()
        },
        "numeric_ranges": {
            "brightness_k": [200, 500],
            "frp_mw": [0, 5000],
            "firms_confidence_pct": [0, 100],
            "observation_count_7d": [0, 100],
            "persistence_hours_7d": [0, 168],
            "frp_trend_pct": [-100, 500],
            "industrial_proximity_km": [0, None],
            "refinery_proximity_km": [0, None],
            "mine_proximity_km": [0, None],
            "forest_proximity_km": [0, None],
            "cropland_proximity_km": [0, None],
            "population_5km": [0, None]
        }
    }


@app.post("/api/predict", response_model=PredictionOutput)
async def predict(input_data: PredictionInput):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        data_dict = input_data.dict()
        
        daynight_val = data_dict["daynight"].upper()
        if daynight_val == "D":
            daynight_val = 1
        elif daynight_val == "N":
            daynight_val = 0
        else:
            raise ValueError("daynight must be 'D' or 'N'")
        
        daynight_encoded = encoders["daynight_encoder"].transform([daynight_val])[0]
        land_cover_encoded = encoders["land_cover_encoder"].transform([data_dict["land_cover"]])[0]
        
        feature_values = [
            data_dict["brightness_k"],
            data_dict["frp_mw"],
            data_dict["firms_confidence_pct"],
            daynight_encoded,
            data_dict["observation_count_7d"],
            data_dict["persistence_hours_7d"],
            data_dict["frp_trend_pct"],
            data_dict["industrial_proximity_km"],
            data_dict["refinery_proximity_km"],
            data_dict["mine_proximity_km"],
            data_dict["forest_proximity_km"],
            data_dict["cropland_proximity_km"],
            data_dict["population_5km"],
            land_cover_encoded
        ]
        
        X = np.array(feature_values).reshape(1, -1)
        proba = model.predict_proba(X)[0]
        pred_class_idx = np.argmax(proba)
        pred_class = encoders["label_encoder"].inverse_transform([pred_class_idx])[0]
        
        all_probs = {
            encoders["label_encoder"].inverse_transform([i])[0]: float(prob)
            for i, prob in enumerate(proba)
        }
        
        return PredictionOutput(
            predicted_class=pred_class,
            confidence=float(proba[pred_class_idx]),
            all_probabilities=all_probs
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/predict_batch")
async def predict_batch(inputs: List[PredictionInput]):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    results = []
    for input_data in inputs:
        try:
            result = await predict(input_data)
            results.append(result)
        except Exception as e:
            results.append({"error": str(e)})
    return results


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "model_loaded": model is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)