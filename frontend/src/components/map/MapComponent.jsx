import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, ZoomControl, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: null, shadowUrl: null });

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api/spatial';

// ─── Utilitaires ───────────────────────────────────────────────────────────────
const fixMojibake = (val) => {
  if (!val || typeof val !== 'string') return val;
  try { return decodeURIComponent(escape(val)); } catch { return val; }
};

const fmt = (n) => {
  if (n == null || isNaN(n)) return '—';
  const num = Number(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + ' M';
  if (num >= 1_000) return num.toLocaleString('fr-FR');
  return num.toString();
};

const pct = (a, b) => (b && b > 0) ? ((Number(a) / Number(b)) * 100).toFixed(1) + '%' : '—';

// ─── Fonds de carte ────────────────────────────────────────────────────────────
const BASEMAPS = [
  { id: 'dark',      label: 'Sombre',    icon: '🌙', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                                       attribution: '© OpenStreetMap | © CARTO' },
  { id: 'satellite', label: 'Satellite', icon: '🛰️', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',                        attribution: '© Esri' },
  { id: 'light',     label: 'Clair',     icon: '☀️', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',                                                       attribution: '© OpenStreetMap | © CARTO' },
];

// ─── Couches ───────────────────────────────────────────────────────────────────
const LAYERS_CONFIG = [
  { id: 'regionbmk',    name: 'Région BMK',     emoji: '🗺️', color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.05, weight: 2.5, count: '1 région',      defaultOn: true,  geomType: 'polygon' },
  { id: 'bmkprovinces', name: 'Provinces',      emoji: '🏛️', color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.08, weight: 2,   count: '5 provinces',    defaultOn: true,  geomType: 'polygon' },
  { id: 'bmkcommunes',  name: 'Communes',       emoji: '🏘️', color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1,   count: '135 communes',   defaultOn: true,  geomType: 'polygon' },
  { id: 'water',        name: "Plans d'eau",    emoji: '💧', color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.5,  weight: 1,   count: '248 entités',    defaultOn: true,  geomType: 'polygon' },
  { id: 'waterways',    name: "Cours d'eau",    emoji: '🌊', color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.3,  weight: 1.5, count: '2 792 entités',  defaultOn: false, geomType: 'polygon' },
  { id: 'landuse',      name: 'Usage des sols', emoji: '🌿', color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.2,  weight: 0.5, count: '6 358 entités',  defaultOn: false, geomType: 'polygon' },
  { id: 'buildings',    name: 'Bâtiments',      emoji: '🏗️', color: '#f97316', fillColor: '#f97316', fillOpacity: 0.4,  weight: 0.5, count: '5 025 entités',  defaultOn: false, geomType: 'polygon' },
  { id: 'places',       name: 'Lieux habités',  emoji: '📍', color: '#ec4899', fillColor: '#ec4899', fillOpacity: 0.5,  weight: 1,   count: '971 entités',    defaultOn: false, geomType: 'point',   radius: 5 },
  { id: 'protectedreas',name: 'Aires protégées',emoji: '🌲', color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.2,  weight: 2,   count: '5 entités',      defaultOn: false, geomType: 'polygon' },
];

const POPULATION_KEYS = ['pop','population','pop_2014','pop_tot','pop2014','pop_total','p_ensemble','p_rurale','p_urbaine','p_feminins','p_masculin','p_menages'];
const COL_LABELS = {
  iso: 'Code ISO', nom_fr: 'Nom (FR)', fclass: 'Classe', type: 'Type',
  p_ensemble: 'Population totale', p_rurale: 'Pop. rurale', p_urbaine: 'Pop. urbaine',
  p_feminins: 'Pop. féminine', p_masculin: 'Pop. masculine', p_menages: 'Ménages',
  s: 'Surface', name: 'Nom', code: 'Code',
};

// ─── Popup HTML ────────────────────────────────────────────────────────────────
const buildPopupContent = (feature, layer) => {
  const props = feature.properties || {};
  const rows = Object.entries(props)
    .filter(([k, v]) => v != null && v !== '' && !['id','geom','nom_ar'].includes(k))
    .slice(0, 10)
    .map(([k, v]) => {
      const isPop = POPULATION_KEYS.includes(k.toLowerCase());
      const rawVal = typeof v === 'string' ? fixMojibake(v) : v;
      const displayVal = isPop ? fmt(rawVal) : rawVal;
      const label = COL_LABELS[k] || k;
      return `<tr>
        <td style="color:#94a3b8;padding:5px 16px 5px 0;font-size:11px;white-space:nowrap;font-weight:500;vertical-align:middle;border-bottom:1px solid rgba(255,255,255,0.05)">${label}</td>
        <td style="font-size:11.5px;font-weight:700;color:${isPop?'#34d399':'#f1f5f9'};vertical-align:middle;border-bottom:1px solid rgba(255,255,255,0.05);padding:5px 0">${displayVal}${isPop?' <span style="font-size:9px;color:#6ee7b7">hab.</span>':''}</td>
      </tr>`;
    }).join('');
  return `<div style="font-family:'Inter',sans-serif;background:#0f172a;border-radius:10px;padding:14px 16px;min-width:240px;max-width:300px">
    <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#f1f5f9;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(99,102,241,0.4)">
      <span>${layer.emoji}</span><span>${layer.name}</span>
    </div>
    <table style="width:100%;border-collapse:collapse">${rows||'<tr><td style="color:#64748b;font-size:11px">Aucune donnée</td></tr>'}</table>
  </div>`;
};

// ─── Graphique Donut SVG ───────────────────────────────────────────────────────
const DonutChart = ({ valueA, valueB, colorA, colorB, labelA, labelB, title }) => {
  const total = (Number(valueA) || 0) + (Number(valueB) || 0);
  if (!total) return null;
  const R = 36, C = 2 * Math.PI * R;
  const dashA = (valueA / total) * C;
  const dashB = (valueB / total) * C;
  const rotateA = -90;
  const rotateB = rotateA + (valueA / total) * 360;
  return (
    <div className="chart-donut-wrapper">
      {title && <div className="chart-title">{title}</div>}
      <div className="chart-donut-inner">
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10"/>
          <circle cx="45" cy="45" r={R} fill="none" stroke={colorA} strokeWidth="10"
            strokeDasharray={`${dashA} ${C}`} strokeLinecap="butt"
            transform={`rotate(${rotateA} 45 45)`}/>
          <circle cx="45" cy="45" r={R} fill="none" stroke={colorB} strokeWidth="10"
            strokeDasharray={`${dashB} ${C}`} strokeLinecap="butt"
            transform={`rotate(${rotateB} 45 45)`}/>
          <text x="45" y="44" textAnchor="middle" fill="#f1f5f9" fontSize="10" fontWeight="700" fontFamily="Inter">
            {pct(valueA, total)}
          </text>
          <text x="45" y="56" textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="Inter">{labelA}</text>
        </svg>
        <div className="chart-donut-legend">
          <div className="legend-row"><span style={{background: colorA}} className="legend-dot"/><span>{labelA}</span><strong>{fmt(valueA)}</strong></div>
          <div className="legend-row"><span style={{background: colorB}} className="legend-dot"/><span>{labelB}</span><strong>{fmt(valueB)}</strong></div>
        </div>
      </div>
    </div>
  );
};

// ─── Graphique Barres Horizontales SVG ─────────────────────────────────────────
const HBarChart = ({ data, title, color = '#6366f1', maxItems = 7 }) => {
  if (!data || !data.length) return null;
  const items = data.slice(0, maxItems);
  const maxVal = Math.max(...items.map(d => Number(d.value) || 0));
  return (
    <div className="chart-hbar-wrapper">
      {title && <div className="chart-title">{title}</div>}
      <div className="chart-hbar-list">
        {items.map((item, i) => {
          const barPct = maxVal > 0 ? (Number(item.value) / maxVal) * 100 : 0;
          return (
            <div key={i} className="chart-hbar-row">
              <div className="chart-hbar-label">{fixMojibake(item.label)}</div>
              <div className="chart-hbar-track">
                <div className="chart-hbar-fill" style={{ width: `${barPct}%`, background: color }} />
              </div>
              <div className="chart-hbar-value">{fmt(item.value)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Jauge ─────────────────────────────────────────────────────────────────────
const GaugeBar = ({ value, max = 100, color, label, sublabel }) => {
  const pctVal = max > 0 ? Math.min((Number(value) / max) * 100, 100) : 0;
  return (
    <div className="gauge-row">
      <div className="gauge-header">
        <span className="gauge-label">{label}</span>
        <span className="gauge-value" style={{ color }}>{sublabel || `${pctVal.toFixed(1)}%`}</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${pctVal}%`, background: color }} />
      </div>
    </div>
  );
};

// ─── FlyTo ─────────────────────────────────────────────────────────────────────
const FlyToLocation = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 12, { duration: 1.2 });
  }, [target, map]);
  return null;
};

// ════════════════════════════════════════════════════════════════════════════════
const MapComponent = () => {
  const BENI_MELLAL_CENTER = [32.3394, -6.3608];
  const DEFAULT_ZOOM = 8;

  const [basemap, setBasemap]         = useState('dark');
  const [activeTab, setActiveTab]     = useState('layers');

  // Stats globales
  const [globalStats, setGlobalStats] = useState(null);
  const [provincesData, setProvincesData] = useState([]);
  const [topCommunes, setTopCommunes] = useState([]);

  // Contexte sélectionné
  const [selectedFeature, setSelectedFeature] = useState(null); // { props, layerId, layerName }
  const [contextHistory, setContextHistory]   = useState([]); // breadcrumb

  // Recherche
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [flyTarget, setFlyTarget]       = useState(null);
  const searchTimeout = useRef(null);

  const currentBasemap = BASEMAPS.find(b => b.id === basemap);

  // ── Couches ─────────────────────────────────────────────────────────────────
  const [layersState, setLayersState] = useState(() => {
    const init = {};
    LAYERS_CONFIG.forEach(l => { init[l.id] = { data: null, loading: false, active: l.defaultOn }; });
    return init;
  });

  const fetchLayer = useCallback((layerId) => {
    setLayersState(prev => ({ ...prev, [layerId]: { ...prev[layerId], loading: true } }));
    fetch(`${API_BASE}/geojson/${layerId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => setLayersState(prev => ({ ...prev, [layerId]: { ...prev[layerId], data, loading: false } })))
      .catch(() => setLayersState(prev => ({ ...prev, [layerId]: { ...prev[layerId], loading: false } })));
  }, []);

  useEffect(() => {
    LAYERS_CONFIG.filter(l => l.defaultOn).forEach(l => fetchLayer(l.id));
  }, [fetchLayer]);

  const toggleLayer = (layerId) => {
    const cur = layersState[layerId];
    const willBeActive = !cur.active;
    setLayersState(prev => ({ ...prev, [layerId]: { ...prev[layerId], active: willBeActive } }));
    if (willBeActive && !cur.data && !cur.loading) fetchLayer(layerId);
  };

  // ── Stats globales ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/stats/overview`).then(r => r.json()).then(setGlobalStats).catch(console.error);
    fetch(`${API_BASE}/stats/provinces`).then(r => r.json()).then(setProvincesData).catch(console.error);
    fetch(`${API_BASE}/stats/top-communes?limit=7`).then(r => r.json()).then(setTopCommunes).catch(console.error);
  }, []);

  // ── Clic sur un feature → contexte dynamique ────────────────────────────────
  // La région BMK ne change pas le contexte (on reste sur les stats globales)
  const handleFeatureClick = useCallback((feature, layerId, layerName) => {
    if (layerId === 'regionbmk') return;
    const props = feature.properties || {};
    setContextHistory(prev => [...prev, selectedFeature]);
    setSelectedFeature({ props, layerId, layerName });
    setActiveTab('stats');
  }, [selectedFeature]);

  const handleBackContext = () => {
    const prev = contextHistory[contextHistory.length - 1];
    setContextHistory(h => h.slice(0, -1));
    setSelectedFeature(prev);
  };

  // ── Recherche commune ────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetch(`${API_BASE}/search/communes?q=${encodeURIComponent(searchQuery)}`)
        .then(r => r.json()).then(setSearchResults).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  const handleSelectResult = (result) => {
    setFlyTarget({ lat: result.lat, lng: result.lng });
    setSearchQuery(fixMojibake(result.nom_fr || ''));
    setSearchResults([]);
  };

  // ── Dérivées ─────────────────────────────────────────────────────────────────
  const activeCount  = Object.values(layersState).filter(l => l.active).length;
  const loadingCount = Object.values(layersState).filter(l => l.loading).length;
  const activeLegendLayers = LAYERS_CONFIG.filter(l => layersState[l.id]?.active);

  // ── Données stats selon contexte ────────────────────────────────────────────
  const contextIsGlobal   = !selectedFeature;
  const contextIsProvince = selectedFeature?.layerId === 'bmkprovinces';
  const contextIsCommune  = selectedFeature?.layerId === 'bmkcommunes';
  const ctxProps          = selectedFeature?.props || {};
  const ctxName           = fixMojibake(ctxProps.nom_fr) || selectedFeature?.layerName || '';

  // KPIs dérivés pour le contexte global
  const densiteGlobale = globalStats ? (globalStats.pop_totale / globalStats.superficie_km2).toFixed(0) : null;
  const taillesMenages = globalStats && globalStats.nb_menages > 0
    ? (globalStats.pop_totale / globalStats.nb_menages).toFixed(1) : null;
  const tauxUrba = globalStats && globalStats.pop_totale > 0
    ? ((globalStats.pop_urbaine / globalStats.pop_totale) * 100).toFixed(1) : null;

  // KPIs pour province/commune sélectionnée
  const popTotaleCtx = Number(ctxProps.p_ensemble) || 0;
  const popMascCtx   = Number(ctxProps.p_masculin)  || 0;
  const popFemCtx    = Number(ctxProps.p_feminins)  || 0;
  const menagesCtx   = Number(ctxProps.p_menages)   || 0;
  const popRuraleCtx = Number(ctxProps.p_rurale)    || 0;
  const popUrbaCtx   = Number(ctxProps.p_urbaine)   || 0;
  const taillesMenagesCtx = menagesCtx > 0 ? (popTotaleCtx / menagesCtx).toFixed(1) : null;
  const pctRegionCtx = globalStats && globalStats.pop_totale > 0
    ? pct(popTotaleCtx, globalStats.pop_totale) : null;

  // Données pour graphiques globaux
  const provincesBarData = provincesData.map(p => ({ label: p.nom_fr, value: p.pop_totale }));
  const topCommunesBarData = topCommunes.map(c => ({ label: c.nom_fr, value: c.pop_totale }));

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">🗺️</div>
            <h1>Plateforme SIG</h1>
          </div>
          <p className="sidebar-subtitle">Béni Mellal-Khénifra</p>
        </div>

        {/* Onglets */}
        <div className="sidebar-tabs">
          <button className={`tab-btn ${activeTab==='layers'?'active':''}`} onClick={() => setActiveTab('layers')}>🗂️ Couches</button>
          <button className={`tab-btn ${activeTab==='stats'?'active':''}`}  onClick={() => setActiveTab('stats')}>📊 Statistiques</button>
        </div>

        <div className="sidebar-body">

          {/* ── Onglet Couches ── */}
          {activeTab === 'layers' && (
            <div className="sidebar-section">
              <div className="section-title">Couches cartographiques ({activeCount} actives)</div>
              {LAYERS_CONFIG.map(layer => {
                const state = layersState[layer.id];
                return (
                  <div key={layer.id} className={`layer-item ${state.active?'active':''}`} onClick={() => toggleLayer(layer.id)}>
                    {layer.geomType === 'point'
                      ? <div className="layer-dot" style={{ backgroundColor: layer.color, borderRadius:'50%', border:`2px solid ${layer.color}` }} />
                      : <div className="layer-dot" style={{ backgroundColor: layer.fillColor+'44', border:`2px solid ${layer.color}`, borderRadius:'3px' }} />
                    }
                    <div className="layer-info">
                      <div className="layer-name">{layer.emoji} {layer.name}</div>
                      <div className="layer-count">{layer.count}</div>
                    </div>
                    {state.loading && <span className="loading-badge">…</span>}
                    <div className="layer-toggle" />
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Onglet Statistiques ── */}
          {activeTab === 'stats' && (
            <div className="sidebar-section stats-section">

              {/* Breadcrumb + Bouton retour */}
              {selectedFeature && (
                <div className="stats-context-bar">
                  <button className="back-btn" onClick={handleBackContext}>← Retour</button>
                  <div className="context-badge">
                    <span>{selectedFeature.layerName}</span>
                    <strong>{ctxName}</strong>
                  </div>
                </div>
              )}

              {/* ── Vue Globale ── */}
              {contextIsGlobal && (
                <>
                  <div className="section-title">📍 Région Béni Mellal-Khénifra</div>

                  {!globalStats ? (
                    <div className="stats-loading">Chargement des données…</div>
                  ) : (
                    <>
                      {/* KPI Grid */}
                      <div className="stats-grid">
                        <div className="stat-card"><div className="stat-icon">🏛️</div><div className="stat-value">{globalStats.nb_provinces}</div><div className="stat-label">Provinces</div></div>
                        <div className="stat-card"><div className="stat-icon">🏘️</div><div className="stat-value">{globalStats.nb_communes}</div><div className="stat-label">Communes</div></div>
                      </div>

                      <div className="stat-row"><span className="stat-row-label">👥 Population totale</span><span className="stat-row-value green">{fmt(globalStats.pop_totale)} hab.</span></div>
                      <div className="stat-row"><span className="stat-row-label">📐 Superficie</span><span className="stat-row-value">{fmt(globalStats.superficie_km2)} km²</span></div>
                      <div className="stat-row"><span className="stat-row-label">🏙️ Taux d'urbanisation</span><span className="stat-row-value accent">{tauxUrba}%</span></div>
                      <div className="stat-row"><span className="stat-row-label">📊 Densité</span><span className="stat-row-value">{fmt(densiteGlobale)} hab/km²</span></div>
                      <div className="stat-row"><span className="stat-row-label">🏠 Taille moy. ménage</span><span className="stat-row-value">{taillesMenages} pers.</span></div>
                      <div className="stat-row"><span className="stat-row-label">📍 Lieux habités</span><span className="stat-row-value">{fmt(globalStats.nb_lieux_habites)}</span></div>

                      {/* Taux urbanisation gauge */}
                      <GaugeBar
                        value={globalStats.pop_urbaine}
                        max={globalStats.pop_totale}
                        color="#3b82f6"
                        label="🏙️ Pop. Urbaine"
                        sublabel={`${fmt(globalStats.pop_urbaine)} hab.`}
                      />
                      <GaugeBar
                        value={globalStats.pop_rurale}
                        max={globalStats.pop_totale}
                        color="#22c55e"
                        label="🌾 Pop. Rurale"
                        sublabel={`${fmt(globalStats.pop_rurale)} hab.`}
                      />

                      {/* Donut Hommes / Femmes */}
                      <DonutChart
                        title="👥 Répartition par genre"
                        valueA={globalStats.pop_masculin}
                        valueB={globalStats.pop_feminin}
                        colorA="#6366f1"
                        colorB="#ec4899"
                        labelA="Hommes"
                        labelB="Femmes"
                      />

                      {/* Bar chart provinces */}
                      {provincesBarData.length > 0 && (
                        <HBarChart title="🏛️ Population par province" data={provincesBarData} color="#f59e0b" />
                      )}

                      {/* Bar chart top communes */}
                      {topCommunesBarData.length > 0 && (
                        <HBarChart title="🏘️ Top communes (population)" data={topCommunesBarData} color="#6366f1" />
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── Vue Province ── */}
              {contextIsProvince && (
                <>
                  <div className="section-title">🏛️ {ctxName}</div>
                  <div className="context-hint">Cliquez sur une commune pour plus de détails</div>

                  <div className="stat-row"><span className="stat-row-label">👥 Population totale</span><span className="stat-row-value green">{fmt(popTotaleCtx)} hab.</span></div>
                  <div className="stat-row"><span className="stat-row-label">🌾 Pop. rurale</span><span className="stat-row-value">{fmt(popRuraleCtx)} hab.</span></div>
                  <div className="stat-row"><span className="stat-row-label">🏙️ Pop. urbaine</span><span className="stat-row-value">{fmt(popUrbaCtx)} hab.</span></div>
                  <div className="stat-row"><span className="stat-row-label">🏠 Ménages</span><span className="stat-row-value">{fmt(menagesCtx)}</span></div>
                  <div className="stat-row"><span className="stat-row-label">🌍 % de la région</span><span className="stat-row-value accent">{pctRegionCtx}</span></div>

                  {/* Urbanisation */}
                  {popUrbaCtx > 0 && (
                    <>
                      <GaugeBar value={popUrbaCtx} max={popTotaleCtx} color="#3b82f6" label="🏙️ Urbaine" sublabel={pct(popUrbaCtx, popTotaleCtx)} />
                      <GaugeBar value={popRuraleCtx} max={popTotaleCtx} color="#22c55e" label="🌾 Rurale" sublabel={pct(popRuraleCtx, popTotaleCtx)} />
                    </>
                  )}

                  {/* Donut H/F */}
                  {(popMascCtx > 0 || popFemCtx > 0) && (
                    <DonutChart
                      title="👥 Répartition par genre"
                      valueA={popMascCtx} valueB={popFemCtx}
                      colorA="#6366f1" colorB="#ec4899"
                      labelA="Hommes" labelB="Femmes"
                    />
                  )}
                </>
              )}

              {/* ── Vue Commune ── */}
              {contextIsCommune && (
                <>
                  <div className="section-title">🏘️ {ctxName}</div>

                  <div className="stat-row"><span className="stat-row-label">👥 Population totale</span><span className="stat-row-value green">{fmt(popTotaleCtx)} hab.</span></div>
                  <div className="stat-row"><span className="stat-row-label">♂ Hommes</span><span className="stat-row-value">{fmt(popMascCtx)} hab.</span></div>
                  <div className="stat-row"><span className="stat-row-label">♀ Femmes</span><span className="stat-row-value">{fmt(popFemCtx)} hab.</span></div>
                  <div className="stat-row"><span className="stat-row-label">🏠 Ménages</span><span className="stat-row-value">{fmt(menagesCtx)}</span></div>
                  {taillesMenagesCtx && <div className="stat-row"><span className="stat-row-label">👨‍👩‍👧 Taille moy. ménage</span><span className="stat-row-value">{taillesMenagesCtx} pers.</span></div>}
                  <div className="stat-row"><span className="stat-row-label">🌍 % de la région</span><span className="stat-row-value accent">{pctRegionCtx}</span></div>

                  {/* Donut H/F */}
                  {(popMascCtx > 0 || popFemCtx > 0) && (
                    <DonutChart
                      title="👥 Répartition par genre"
                      valueA={popMascCtx} valueB={popFemCtx}
                      colorA="#6366f1" colorB="#ec4899"
                      labelA="Hommes" labelB="Femmes"
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <p>Données OSM &amp; SIG-Maroc • <span>PostGIS</span> • <span>FastAPI</span></p>
        </div>
      </aside>

      {/* ══ CARTE ════════════════════════════════════════════════════════════ */}
      <div className="map-area">

        {/* Topbar */}
        <div className="map-topbar">
          <div className="map-title-badge">
            <h2>Région Béni Mellal-Khénifra</h2>
            <p>Aide à la décision territoriale</p>
          </div>
          <div className="map-status">
            <div className="status-dot" />
            API connectée
            {loadingCount > 0 && ` • ${loadingCount} couche(s) en chargement`}
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="search-bar-wrapper">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Rechercher une commune…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className="search-input" />
            {searchQuery && <button className="search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>✕</button>}
          </div>
          {searchResults.length > 0 && (
            <ul className="search-results">
              {searchResults.map((r, i) => (
                <li key={i} className="search-result-item" onClick={() => handleSelectResult(r)}>
                  <span className="search-result-name">🏘️ {fixMojibake(r.nom_fr)}</span>
                  {r.p_ensemble && <span className="search-result-pop">{fmt(r.p_ensemble)} hab.</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sélecteur fond de carte */}
        <div className="basemap-switcher">
          {BASEMAPS.map(bm => (
            <button key={bm.id} className={`basemap-btn ${basemap===bm.id?'active':''}`} onClick={() => setBasemap(bm.id)}>
              <span className="basemap-icon">{bm.icon}</span>
              <span className="basemap-label">{bm.label}</span>
            </button>
          ))}
        </div>

        {/* Légende */}
        {activeLegendLayers.length > 0 && (
          <div className="map-legend">
            <div className="legend-title">Légende</div>
            {activeLegendLayers.map(layer => (
              <div key={layer.id} className="legend-item">
                {layer.geomType === 'point'
                  ? <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill={layer.fillColor} fillOpacity={0.9} stroke={layer.color} strokeWidth="1.5"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" fill={layer.fillColor} fillOpacity={layer.fillOpacity+0.1} stroke={layer.color} strokeWidth="1.5" rx="2"/></svg>
                }
                <span>{layer.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Leaflet Map ── */}
        <MapContainer center={BENI_MELLAL_CENTER} zoom={DEFAULT_ZOOM} zoomControl={false} style={{ width:'100%', height:'100%' }}>
          <TileLayer key={currentBasemap.id} url={currentBasemap.url} attribution={currentBasemap.attribution} maxZoom={19} />
          <ZoomControl position="bottomright" />
          <FlyToLocation target={flyTarget} />

          {LAYERS_CONFIG.map(layer => {
            const state = layersState[layer.id];
            if (!state.active || !state.data?.features?.length) return null;

            if (layer.geomType === 'polygon') {
              return (
                <GeoJSON
                  key={`${layer.id}-${state.data.features.length}`}
                  data={state.data}
                  style={{ color: layer.color, weight: layer.weight, fillColor: layer.fillColor, fillOpacity: layer.fillOpacity, opacity: 0.85 }}
                  onEachFeature={(feature, lyr) => {
                    lyr.bindPopup(buildPopupContent(feature, layer));
                    lyr.on({
                      click:     () => handleFeatureClick(feature, layer.id, layer.name),
                      mouseover: e => e.target.setStyle({ fillOpacity: Math.min(layer.fillOpacity+0.25, 0.9), weight: layer.weight+1 }),
                      mouseout:  e => e.target.setStyle({ fillOpacity: layer.fillOpacity, weight: layer.weight }),
                    });
                  }}
                />
              );
            }

            if (layer.geomType === 'point') {
              return state.data.features
                .filter(f => {
                  if (!f.geometry?.coordinates) return false;
                  const coords = f.geometry.coordinates;
                  const [lng, lat] = f.geometry.type === 'MultiPoint' ? (coords[0] || []) : coords;
                  return lng != null && lat != null && !isNaN(+lng) && !isNaN(+lat) && +lat >= -90 && +lat <= 90 && +lng >= -180 && +lng <= 180;
                })
                .map((f, idx) => {
                  const coords = f.geometry.coordinates;
                  const [lng, lat] = f.geometry.type === 'MultiPoint' ? (coords[0] || []) : coords;
                  return (
                    <CircleMarker key={`${layer.id}-${idx}`} center={[+lat, +lng]} radius={layer.radius || 5}
                      pathOptions={{ color: layer.color, fillColor: layer.fillColor, fillOpacity: layer.fillOpacity, weight: layer.weight }}>
                      <Popup><div dangerouslySetInnerHTML={{ __html: buildPopupContent(f, layer) }} /></Popup>
                    </CircleMarker>
                  );
                });
            }
            return null;
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapComponent;
