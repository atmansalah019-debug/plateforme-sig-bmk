from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Any, Dict, List, Optional

from app.db.session import get_db

router = APIRouter()

# Cache mémoire pour les statistiques (données statiques, jamais recalculées)
_stats_cache: Optional[Dict[str, Any]] = None
_provinces_cache: Optional[List[Dict[str, Any]]] = None
_top_communes_cache: Optional[List[Dict[str, Any]]] = None

# Liste sécurisée des tables autorisées
ALLOWED_LAYERS = {
    "regionbmk",        # Region Béni Mellal-Khénifra
    "bmkprovinces",     # Provinces
    "bmkcommunes",      # Communes
    "waterways",        # Cours d'eau
    "water",            # Plans d'eau
    "buildings",        # Bâtiments
    "landuse",          # Occupation des sols
    "places",           # Lieux habités
    "protectedreas",    # Zones protégées
}


@router.get("/geojson/{layer_name}", response_model=Dict[str, Any])
async def get_geojson_layer(
    layer_name: str = Path(..., description="Nom de la couche géographique"),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère une couche spatiale entière au format GeoJSON.
    La transformation est effectuée directement par PostGIS pour des performances maximales.
    """
    if layer_name not in ALLOWED_LAYERS:
        raise HTTPException(status_code=404, detail="Couche introuvable ou non autorisée")

    query = text(f"""
        SELECT jsonb_build_object(
            'type',     'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
        ) AS geojson
        FROM (
          SELECT jsonb_build_object(
            'type',       'Feature',
            'id',         id,
            'geometry',   ST_AsGeoJSON(geom)::jsonb,
            'properties', to_jsonb(inputs) - 'id' - 'geom' - 'nom_ar'
          ) AS feature
          FROM (SELECT * FROM "{layer_name}") inputs
        ) features;
    """)

    result = await db.execute(query)
    row = result.scalar()

    if not row:
        return {"type": "FeatureCollection", "features": []}

    return row


@router.get("/stats/overview", response_model=Dict[str, Any])
async def get_stats_overview(db: AsyncSession = Depends(get_db)):
    """
    Retourne les statistiques globales de la région.
    Mis en cache après le premier appel (données statiques).
    """
    global _stats_cache
    if _stats_cache is not None:
        return _stats_cache

    query = text("""
        SELECT
            (SELECT COUNT(*)::int    FROM bmkcommunes)                                        AS nb_communes,
            (SELECT COUNT(*)::int    FROM bmkprovinces)                                       AS nb_provinces,
            (SELECT SUM(p_ensemble)::bigint FROM bmkcommunes WHERE p_ensemble IS NOT NULL)    AS pop_totale,
            (SELECT SUM(p_masculin)::bigint FROM bmkcommunes WHERE p_masculin IS NOT NULL)    AS pop_masculin,
            (SELECT SUM(p_feminins)::bigint FROM bmkcommunes WHERE p_feminins IS NOT NULL)    AS pop_feminin,
            (SELECT SUM(p_rurale)::bigint   FROM bmkprovinces WHERE p_rurale  IS NOT NULL)   AS pop_rurale,
            (SELECT SUM(p_urbaine)::bigint  FROM bmkprovinces WHERE p_urbaine IS NOT NULL)   AS pop_urbaine,
            (SELECT SUM(p_menages)::bigint  FROM bmkcommunes WHERE p_menages  IS NOT NULL)    AS nb_menages,
            28161                                                                             AS superficie_km2,
            (SELECT COUNT(*)::int    FROM places)                                             AS nb_lieux_habites
    """)

    result = await db.execute(query)
    row = result.mappings().first()
    if not row:
        return {}

    _stats_cache = dict(row)
    return _stats_cache


@router.get("/stats/provinces", response_model=List[Dict[str, Any]])
async def get_provinces_stats(db: AsyncSession = Depends(get_db)):
    """
    Retourne les statistiques de chaque province (pour les graphiques).
    Mis en cache après le premier appel.
    """
    global _provinces_cache
    if _provinces_cache is not None:
        return _provinces_cache

    query = text("""
        SELECT
            nom_fr,
            p_ensemble::bigint  AS pop_totale,
            p_masculin::bigint  AS pop_masculin,
            p_feminins::bigint  AS pop_feminin,
            p_urbaine::bigint   AS pop_urbaine,
            p_rurale::float     AS pop_rurale,
            p_menages::float    AS nb_menages
        FROM bmkprovinces
        WHERE p_ensemble IS NOT NULL
        ORDER BY p_ensemble DESC
    """)

    result = await db.execute(query)
    rows = result.mappings().all()
    _provinces_cache = [dict(r) for r in rows]
    return _provinces_cache


@router.get("/stats/top-communes", response_model=List[Dict[str, Any]])
async def get_top_communes(
    limit: int = Query(default=7, ge=1, le=20),
    db: AsyncSession = Depends(get_db)
):
    """
    Retourne les communes les plus peuplées pour le graphique bar chart.
    """
    global _top_communes_cache
    if _top_communes_cache is not None:
        return _top_communes_cache

    query = text("""
        SELECT
            nom_fr,
            p_ensemble::bigint AS pop_totale,
            p_masculin::bigint AS pop_masculin,
            p_feminins::bigint AS pop_feminin,
            p_menages::float   AS nb_menages
        FROM bmkcommunes
        WHERE p_ensemble IS NOT NULL
        ORDER BY p_ensemble DESC
        LIMIT :limit
    """)

    result = await db.execute(query, {"limit": limit})
    rows = result.mappings().all()
    _top_communes_cache = [dict(r) for r in rows]
    return _top_communes_cache


@router.get("/search/communes", response_model=List[Dict[str, Any]])
async def search_communes(
    q: str = Query(..., min_length=2, description="Terme de recherche (nom de commune)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Recherche des communes par nom (nom_fr).
    Retourne les 10 premiers résultats avec leurs coordonnées centroïdes.
    """
    query = text("""
        SELECT
            id,
            nom_fr,
            p_ensemble,
            ST_X(ST_Centroid(geom)) AS lng,
            ST_Y(ST_Centroid(geom)) AS lat
        FROM bmkcommunes
        WHERE LOWER(nom_fr) LIKE LOWER(:search)
        ORDER BY nom_fr
        LIMIT 10
    """)
    result = await db.execute(query, {"search": f"%{q}%"})
    rows = result.mappings().all()
    return [dict(r) for r in rows]
