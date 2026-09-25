"""AI Explainer Service powered by Google Gemini (Flash).
Generates concise 2-3 sentence grounded natural-language explanations of fire classifications.
Strictly constrained to provided data; never invents facts or companies.
Fails gracefully to None without crashing callers if API is unavailable.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("ai_explainer")

# In-memory explanation cache (keyed by content hash, 1 hour TTL)
_explanation_cache: dict[str, dict[str, Any]] = {}

EXPLAINER_SYSTEM_INSTRUCTION = (
    "You are an AI Earth Observation specialist for the THERMOS satellite monitoring system. "
    "Your task is to generate a concise 2-3 sentence explanation of why a given fire detection "
    "was classified the way it was, using plain, professional language. "
    "You must base your explanation ONLY on the supplied detection, classification, NASA FIRMS, "
    "OpenStreetMap (OSM), and Copernicus Sentinel data. "
    "CRITICAL CONSTRAINTS: "
    "- Do NOT invent or speculate on specific company or facility names unless explicitly present in OSM tags. "
    "- Do NOT invent causes of the fire (e.g. electrical short, arson, equipment failure). "
    "- Do NOT invent casualties, injuries, evacuations, or damage estimates. "
    "- Do NOT invent weather conditions (wind, humidity, rain). "
    "- If indicators are mixed or context is unavailable, state that the classification is based on available indicators rather than claiming certainty."
)


def _get_gemini_api_key() -> str:
    """Retrieve GEMINI_API_KEY from Settings or environment."""
    settings = get_settings()
    key = getattr(settings, "GEMINI_API_KEY", "") or os.environ.get("GEMINI_API_KEY", "")
    return key.strip()


def generate_fire_explanation(context: dict[str, Any]) -> str | None:
    """Generate a 2-3 sentence explanation from Gemini Flash based on classification and context data.
    Input context format:
    {
      "category": "Industrial Fire",
      "confidence": 0.84,
      "risk_score": 47.6,
      "firms": {"brightness": 348.5, "frp": 35.0},
      "osm": {
        "is_industrial": True,
        "nearest_industrial_distance_m": 0.0,
        "relevant_tags": {"landuse": "industrial", "industrial": "oil_refinery"}
      },
      "copernicus": {
        "land_cover_type": "built_up",
        "ndvi_value": 0.18
      }
    }
    Returns string explanation, or None on failure/missing key.
    """
    settings = get_settings()
    log.info("[ai_explainer] generate_fire_explanation called. ENABLE_AI=%s", getattr(settings, "ENABLE_AI", True))
    if not getattr(settings, "ENABLE_AI", True):
        log.info("[ai_explainer] ENABLE_AI is false, returning None")
        return None

    api_key = _get_gemini_api_key()
    log.info("[ai_explainer] GEMINI_API_KEY configured: %s (length: %d)", bool(api_key), len(api_key) if api_key else 0)
    if not api_key:
        log.info("[ai_explainer] GEMINI_API_KEY not configured; skipping AI explanation.")
        return None

    # Generate a deterministic cache key from input context
    cache_str = json.dumps(context, sort_keys=True, default=str)
    cache_hash = hashlib.md5(cache_str.encode()).hexdigest()
    now = time.time()
    if cache_hash in _explanation_cache and now - _explanation_cache[cache_hash]["_ts"] < 3600:
        log.info("[ai_explainer] Cache hit for explanation")
        return _explanation_cache[cache_hash]["explanation"]

    # Extract structured fields
    category = (
        context.get("category")
        or (context.get("classification") or {}).get("category")
        or (context.get("classification") or {}).get("label")
        or "Thermal Hotspot"
    )
    confidence = (
        context.get("confidence")
        or (context.get("classification") or {}).get("confidence")
        or "N/A"
    )
    risk_score = (
        context.get("risk_score")
        or (context.get("classification") or {}).get("risk_score")
        or "N/A"
    )
    firms = context.get("firms") or {}
    osm = context.get("osm") or context.get("osm_context") or {}
    copernicus = context.get("copernicus") or context.get("copernicus_context") or {}

    user_prompt = f"""Explain this fire event classification in 2-3 sentences based ONLY on the evidence below:

Classification:
- Category: {category}
- Confidence: {confidence}
- Operational Risk Score: {risk_score}

NASA FIRMS Satellite Observation:
- Brightness Temperature: {firms.get('brightness', 'N/A')} K
- Fire Radiative Power (FRP): {firms.get('frp', 'N/A')} MW
- Confidence: {firms.get('confidence', 'N/A')}

OpenStreetMap Industrial Context:
- Is Industrial Zone: {osm.get('is_industrial', False)}
- Nearest Industrial Distance: {osm.get('nearest_industrial_distance_m', 'None')} m
- Matched Tags: {json.dumps(osm.get('relevant_tags') or osm.get('matched_tags') or {})}

Copernicus Sentinel Context:
- Land Cover Type: {copernicus.get('land_cover_type', 'unavailable')}
- NDVI Vegetation Index: {copernicus.get('ndvi_value', 'unavailable')}
"""

    # Model configuration: default to gemini-flash-lite-latest (verified active in v1beta API)
    model_name = getattr(settings, "GEMINI_MODEL", "gemini-flash-lite-latest") or "gemini-flash-lite-latest"
    api_version = "v1beta"
    endpoint = f"https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent?key={api_key}"
    log.info("[ai_explainer] Using model: %s, endpoint: %s", model_name, endpoint)

    request_body = {
        "system_instruction": {
            "parts": [{"text": EXPLAINER_SYSTEM_INSTRUCTION}]
        },
        "contents": [
            {
                "parts": [{"text": user_prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 250,
            "topP": 0.8
        }
    }

    try:
        with httpx.Client(timeout=8.0) as client:
            log.info("[ai_explainer] Sending request to Gemini API...")
            resp = client.post(endpoint, json=request_body)
            log.info("[ai_explainer] Gemini API response status: %s", resp.status_code)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        explanation = parts[0]["text"].strip()
                        _explanation_cache[cache_hash] = {"_ts": now, "explanation": explanation}
                        log.info("[ai_explainer] Successfully generated explanation: %s...", explanation[:100])
                        return explanation
                log.warning("[ai_explainer] Gemini API returned 200 but no candidate text found: %s", data)
            elif resp.status_code in (404, 429, 503):
                # Model not found (404), rate limited (429), or overloaded (503) - try fallback chain with v1beta API
                fallback_models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.8-flash"]
                for fb_model in fallback_models:
                    if fb_model == model_name:
                        continue
                    fallback_url = f"https://generativelanguage.googleapis.com/v1beta/models/{fb_model}:generateContent?key={api_key}"
                    log.info("[ai_explainer] Trying fallback model: %s (v1beta API)", fb_model)
                    try:
                        with httpx.Client(timeout=8.0) as fb_client:
                            fb_resp = fb_client.post(fallback_url, json=request_body)
                            log.info("[ai_explainer] Fallback %s response status: %s", fb_model, fb_resp.status_code)
                            if fb_resp.status_code == 200:
                                fb_data = fb_resp.json()
                                candidates = fb_data.get("candidates", [])
                                if candidates:
                                    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                                    if text:
                                        _explanation_cache[cache_hash] = {"_ts": now, "explanation": text}
                                        log.info("[ai_explainer] Fallback succeeded with %s: %s...", fb_model, text[:100])
                                        return text
                            else:
                                log.warning("[ai_explainer] Fallback %s failed: %s", fb_model, fb_resp.text[:300])
                    except Exception as fb_e:
                        log.warning("[ai_explainer] Fallback %s exception: %s", fb_model, fb_e)
            else:
                log.warning("[ai_explainer] Gemini API returned status %s: %s", resp.status_code, resp.text[:500])
    except Exception as e:
        log.exception("[ai_explainer] Failed to generate Gemini explanation: %s", e)

    # Return None on any failure so parent classification request succeeds untouched
    log.info("[ai_explainer] Returning None (explanation generation failed)")
    return None
