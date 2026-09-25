"""ESA WorldCover WMS Land Cover Service alias.
Re-exports the functions from app.services.copernicus_service for standardized naming.
"""
from __future__ import annotations

from app.services.copernicus_service import (
    ESA_CLASS_CODES,
    ESA_PALETTE,
    PRIMARY_LAYER,
    PRIMARY_WMS_URL,
    TITILER_LAYER,
    TITILER_WMS_URL,
    derive_land_cover_from_ndvi,
    get_copernicus_context,
    get_land_cover_context,
    get_worldcover_context,
)

__all__ = [
    "derive_land_cover_from_ndvi",
    "get_copernicus_context",
    "get_land_cover_context",
    "get_worldcover_context",
    "ESA_PALETTE",
    "ESA_CLASS_CODES",
    "PRIMARY_WMS_URL",
    "PRIMARY_LAYER",
    "TITILER_WMS_URL",
    "TITILER_LAYER",
]
