# THERMOS API Deployment Guide

## Quick Start with Docker

```bash
# Build and run
docker-compose up --build -d

# Check logs
docker-compose logs -f thermos-api

# Stop
docker-compose down
```

Access at: http://localhost (via nginx) or http://localhost:8000 (direct)

---

## Manual Deployment

### 1. Install dependencies
```bash
pip install -r ml/requirements.txt
```

### 2. Run with Gunicorn (production)
```bash
cd ml/api
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 3. Run with Uvicorn (development)
```bash
cd ml/api
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Cloud Deployment Options

### Render.com (Free tier)
1. Connect GitHub repo
2. New Web Service
3. Build: `pip install -r ml/requirements.txt`
4. Start: `uvicorn ml.api.main:app --host 0.0.0.0 --port $PORT`

### Railway.app
```bash
railway login
railway init
railway up
```

### Fly.io
```bash
fly launch
fly deploy
```

### AWS ECS / Google Cloud Run / Azure Container Apps
- Use the Dockerfile
- Set port to 8000
- Mount model volume or include models in image

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8000 | Server port |
| MODEL_PATH | /app/models/xgboost_classifier.pkl | Model file path |
| ENCODERS_PATH | /app/models/label_encoders.pkl | Encoders file path |

---

## Health Check

```bash
curl http://localhost:8000/api/health
# {"status": "healthy", "model_loaded": true}
```

---

## API Usage

```bash
# Single prediction
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "brightness_k": 367.0,
    "frp_mw": 50.0,
    "firms_confidence_pct": 90,
    "daynight": "D",
    "observation_count_7d": 7,
    "persistence_hours_7d": 50.0,
    "frp_trend_pct": 10.0,
    "industrial_proximity_km": 2.0,
    "refinery_proximity_km": 5.0,
    "mine_proximity_km": 10.0,
    "forest_proximity_km": 20.0,
    "cropland_proximity_km": 30.0,
    "population_5km": 1000,
    "land_cover": "Industrial"
  }'
```