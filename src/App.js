import { useState, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// PRICE DB
// ============================================================
const PRICE_DB = {
  materials: {
    sibirsky_modrin_board: { label: "Palubka Sibiřský modřín 28×120mm", unit: "bm",  unitPrice: 89,  weight: 0.42 },
    thermowood_board:      { label: "Palubka Thermowood 26×120mm",       unit: "bm",  unitPrice: 145, weight: 0.35 },
    bangkirai_board:       { label: "Palubka Bangkirai 21×145mm",        unit: "bm",  unitPrice: 195, weight: 0.55 },
    joist_120x45:          { label: "Rošt KVH 45×120mm (impregnovaný)",  unit: "bm",  unitPrice: 62,  weight: 1.8  },
    screw_a4_45:           { label: "Nerezový šroub A4 4,5×50mm",        unit: "ks",  unitPrice: 2.8, weight: 0.015},
    screw_hidden:          { label: "Nerezová spona Deckfix",             unit: "ks",  unitPrice: 4.2, weight: 0.018},
    gumotextil_pad:        { label: "Gumotextilní podložka 100×100mm",   unit: "ks",  unitPrice: 12,  weight: 0.08 },
    concrete_tile_40:      { label: "Betonová dlaždice 40×40×4cm",       unit: "ks",  unitPrice: 45,  weight: 15   },
    pedestal_adj:          { label: "Rektifikační terč stavitelný",       unit: "ks",  unitPrice: 185, weight: 0.45 },
    oil_osmo:              { label: "Olej OSMO 2,5L",                    unit: "ks",  unitPrice: 890, weight: 2.6, coverage_m2_per_unit: 25 },
    oil_remmers:           { label: "Olej Remmers HK 2,5L",              unit: "ks",  unitPrice: 720, weight: 2.4, coverage_m2_per_unit: 20 },
    oil_bivos:             { label: "Olej Bivos 1L",                     unit: "ks",  unitPrice: 380, weight: 1.1, coverage_m2_per_unit: 12 },
  },
  labor: {
    assembly:          { label: "Montáž terasy (práce)",        unit: "m²",     unitPrice: 450  },
    leveling:          { label: "Nivelace a příprava podkladu", unit: "m²",     unitPrice: 120  },
    oiling:            { label: "Olejování (2 strany + rošt)",  unit: "m²",     unitPrice: 85   },
    transport:         { label: "Doprava materiálu",            unit: "paušál", unitPrice: 2200 },
    material_handling: { label: "Přesun hmot",                  unit: "t",      unitPrice: 380  },
  },
};

const UNITS = ["bm", "m²", "m³", "ks", "kg", "t", "paušál", "hod", "bal"];

const PRESETS = [
  { id: "modrin_dlazdice",  label: "Modřín / dlaždice",  icon: "🌲", board: "sibirsky_modrin_board", joist: "joist_120x45", screw: "screw_a4_45",  support: "concrete_tile_40", oil: "oil_bivos",   usePedestals: false, boardWidth: 120, boardThickness: 28, joistSpan: 500, supportSpacing: 600, screwsPerM2: 35, gapMm: 6 },
  { id: "modrin_terce",     label: "Modřín / terče",     icon: "🔩", board: "sibirsky_modrin_board", joist: "joist_120x45", screw: "screw_a4_45",  support: "pedestal_adj",    oil: "oil_bivos",   usePedestals: true,  boardWidth: 120, boardThickness: 28, joistSpan: 500, supportSpacing: 600, screwsPerM2: 35, gapMm: 6 },
  { id: "thermowood_terce", label: "Thermowood / terče", icon: "♨️", board: "thermowood_board",      joist: "joist_120x45", screw: "screw_hidden", support: "pedestal_adj",    oil: "oil_remmers", usePedestals: true,  boardWidth: 120, boardThickness: 26, joistSpan: 500, supportSpacing: 600, screwsPerM2: 30, gapMm: 5 },
  { id: "bangkirai_terce",  label: "Bangkirai premium",  icon: "✨", board: "bangkirai_board",       joist: "joist_120x45", screw: "screw_hidden", support: "pedestal_adj",    oil: "oil_osmo",    usePedestals: true,  boardWidth: 145, boardThickness: 21, joistSpan: 500, supportSpacing: 700, screwsPerM2: 28, gapMm: 5 },
];

const DEFAULT_PRESET = PRESETS[1];

// ============================================================
// CALCULATION ENGINE
// ============================================================
function buildLines({ length, width, config, margin }) {
  const area = length * width;
  const boardWidthM = (config.boardWidth + config.gapMm) / 1000;
  const boardBm = Math.ceil(width / boardWidthM) * length * 1.10;
  const joistRows = Math.ceil(width / (config.joistSpan / 1000)) + 1;
  const joistBm = joistRows * width * 1.05;
  const supportsPerRow = Math.ceil(length / (config.supportSpacing / 1000)) + 1;
  const totalSupports = joistRows * supportsPerRow;
  const gumoPads = totalSupports * (config.usePedestals ? 1 : 2);
  const totalScrews = Math.ceil(area * config.screwsPerM2 * 1.05);
  const oilArea = area * 2 + joistRows * width * 0.045;
  const oilData = PRICE_DB.materials[config.oil];
  const oilUnits = Math.ceil(oilArea / oilData.coverage_m2_per_unit);
  const am = (p) => parseFloat((p * (1 + margin / 100)).toFixed(2));

  const totalWeightKg =
    boardBm * PRICE_DB.materials[config.board].weight +
    joistBm * PRICE_DB.materials[config.joist].weight +
    totalScrews * PRICE_DB.materials[config.screw].weight +
    totalSupports * PRICE_DB.materials[config.support].weight +
    gumoPads * PRICE_DB.materials.gumotextil_pad.weight +
    oilUnits * oilData.weight;

  const M = PRICE_DB.materials;
  const L = PRICE_DB.labor;

  return [
    { line_key: "board",    category: "material", label: M[config.board].label,    qty: parseFloat(boardBm.toFixed(1)),              unit: "bm",      unit_price: am(M[config.board].unitPrice),    sort_order: 1  },
    { line_key: "joist",    category: "material", label: M[config.joist].label,    qty: parseFloat(joistBm.toFixed(1)),              unit: "bm",      unit_price: am(M[config.joist].unitPrice),    sort_order: 2  },
    { line_key: "screw",    category: "material", label: M[config.screw].label,    qty: totalScrews,                                 unit: "ks",      unit_price: am(M[config.screw].unitPrice),    sort_order: 3  },
    { line_key: "support",  category: "material", label: M[config.support].label,  qty: totalSupports,                               unit: "ks",      unit_price: am(M[config.support].unitPrice),  sort_order: 4  },
    { line_key: "pad",      category: "material", label: M.gumotextil_pad.label,   qty: gumoPads,                                    unit: "ks",      unit_price: am(M.gumotextil_pad.unitPrice),   sort_order: 5  },
    { line_key: "oil",      category: "material", label: oilData.label,            qty: oilUnits,                                    unit: "ks",      unit_price: am(oilData.unitPrice),            sort_order: 6  },
    { line_key: "assembly", category: "labor",    label: L.assembly.label,         qty: parseFloat(area.toFixed(2)),                 unit: "m²",      unit_price: am(L.assembly.unitPrice),         sort_order: 10 },
    { line_key: "leveling", category: "labor",    label: L.leveling.label,         qty: parseFloat(area.toFixed(2)),                 unit: "m²",      unit_price: am(L.leveling.unitPrice),         sort_order: 11 },
    { line_key: "oiling",   category: "labor",    label: L.oiling.label,           qty: parseFloat(area.toFixed(2)),                 unit: "m²",      unit_price: am(L.oiling.unitPrice),           sort_order: 12 },
    { line_key: "transport",category: "labor",    label: L.transport.label,        qty: 1,                                           unit: "paušál",  unit_price: am(L.transport.unitPrice),        sort_order: 13 },
    { line_key: "handling", category: "labor",    label: L.material_handling.label,qty: parseFloat((totalWeightKg / 1000).toFixed(3)),unit: "t",      unit_price: am(L.material_handling.unitPrice),sort_order: 14 },
  ].map(l => ({ ...l, total: parseFloat((l.qty * l.unit_price).toFixed(2)), is_custom: false, is_deleted: false }));
}

// ============================================================
// HELPERS
// ============================================================
const czk = n => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);
const uid = () => crypto.randomUUID();
const STATUS_LABELS = { draft: "Koncept", sent: "Odesláno", approved: "Schváleno", archived: "Archiv" };
const STATUS_COLORS = { draft: "#7a6a5a", sent: "#4a7a9a", approved: "#5a8c5a", archived: "#444" };

const EMPTY_STATE = {
  activeId: null,
  calcName: "Nová kalkulace",
  calcClient: "",
  calcStatus: "draft",
  calcNote: "",
  length: 5,
  width: 4,
  margin: 20,
  vatRate: 21,
  preset: DEFAULT_PRESET,
  config: { ...DEFAULT_PRESET },
  lines: [],
  linesEdited: false,
};

// ============================================================
// STYLES
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0f0d0b;--bg2:#1a1612;--bg3:#231e18;--bg4:#2a2318;
  --border:#2e2820;--border2:#3a3228;
  --amber:#d4873a;--amber2:#f0a642;--amber3:#7a4a18;--amber4:#3d2508;
  --green:#5a8c5a;--red:#c04a3a;--blue:#4a7a9a;
  --text:#e8ddd0;--text2:#9a8878;--text3:#5e5048;
  --ff-head:'Bebas Neue',sans-serif;
  --ff-mono:'IBM Plex Mono',monospace;
  --ff-body:'IBM Plex Sans',sans-serif;
  --r:6px;
}
body{background:var(--bg);color:var(--text);font-family:var(--ff-body);min-height:100vh;
  background-image:repeating-linear-gradient(0deg,transparent,transparent 39px,var(--border) 39px,var(--border) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,var(--border) 39px,var(--border) 40px);
  background-size:40px 40px;}

.shell{display:flex;min-height:100vh;}
.sidebar{width:280px;min-height:100vh;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;}
.main{flex:1;overflow:auto;padding:24px;}
@media(max-width:700px){.shell{flex-direction:column;}.sidebar{width:100%;min-height:auto;border-right:none;border-bottom:1px solid var(--border);}}

.sb-header{padding:20px;border-bottom:1px solid var(--border);}
.sb-logo{font-family:var(--ff-head);font-size:28px;color:var(--amber2);letter-spacing:3px;text-shadow:0 0 30px var(--amber3);}
.sb-sub{font-family:var(--ff-mono);font-size:9px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
.sb-new-btn{margin:14px;padding:11px;background:var(--amber3);border:1px solid var(--amber);border-radius:var(--r);color:var(--amber2);font-family:var(--ff-head);font-size:18px;letter-spacing:2px;cursor:pointer;width:calc(100% - 28px);text-align:center;transition:all .15s;display:block;}
.sb-new-btn:hover{background:var(--amber);color:var(--bg);}
.sb-section{padding:0 14px;margin-bottom:6px;font-family:var(--ff-mono);font-size:9px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;}
.calc-list{flex:1;overflow-y:auto;padding:0 14px 20px;}
.calc-item{padding:12px 10px;border-radius:var(--r);border:1px solid var(--border);margin-bottom:8px;cursor:pointer;transition:all .15s;}
.calc-item:hover{border-color:var(--amber3);background:var(--bg3);}
.calc-item.active{border-color:var(--amber);background:var(--amber4);}
.ci-name{font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ci-meta{font-family:var(--ff-mono);font-size:10px;color:var(--text3);display:flex;gap:8px;flex-wrap:wrap;}
.ci-total{font-family:var(--ff-mono);font-size:12px;color:var(--amber2);margin-top:4px;font-weight:600;}
.status-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:middle;}
.sb-empty{padding:30px 14px;text-align:center;font-family:var(--ff-mono);font-size:11px;color:var(--text3);letter-spacing:1px;}

.mh{display:flex;align-items:flex-start;gap:12px;margin-bottom:22px;flex-wrap:wrap;}
.mh-left{flex:1;min-width:200px;}
.mh-title-input{font-family:var(--ff-head);font-size:clamp(22px,5vw,36px);letter-spacing:2px;color:var(--amber2);background:none;border:none;border-bottom:2px solid transparent;outline:none;width:100%;padding:2px 0;transition:border-color .15s;}
.mh-title-input:focus{border-bottom-color:var(--amber3);}
.mh-client-input{font-family:var(--ff-mono);font-size:12px;color:var(--text2);background:none;border:none;border-bottom:1px solid var(--border);outline:none;padding:3px 0;transition:border-color .15s;width:100%;margin-top:6px;}
.mh-client-input:focus{border-bottom-color:var(--amber3);}
.mh-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;}
.status-select{font-family:var(--ff-mono);font-size:10px;background:var(--bg3);border:1px solid var(--border);border-radius:20px;color:var(--text2);padding:5px 10px;cursor:pointer;outline:none;}
.save-btn{padding:9px 20px;background:var(--green);border:none;border-radius:var(--r);color:#fff;font-family:var(--ff-mono);font-size:11px;letter-spacing:1px;cursor:pointer;transition:all .15s;white-space:nowrap;}
.save-btn:hover{filter:brightness(1.2);}
.save-btn:disabled{opacity:.5;cursor:not-allowed;}
.del-btn{padding:9px 12px;background:none;border:1px solid var(--border);border-radius:var(--r);color:var(--red);font-family:var(--ff-mono);font-size:11px;cursor:pointer;transition:all .15s;}
.del-btn:hover{background:var(--red);color:#fff;border-color:var(--red);}

.slabel{font-family:var(--ff-mono);font-size:9px;color:var(--amber);letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:10px;}
.slabel::after{content:'';flex:1;height:1px;background:var(--border);}

.preset-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:18px;}
@media(min-width:900px){.preset-grid{grid-template-columns:repeat(4,1fr);}}
.preset-btn{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:10px 8px;cursor:pointer;text-align:center;transition:all .15s;color:var(--text2);font-size:12px;font-weight:500;line-height:1.3;font-family:var(--ff-body);}
.preset-btn .pi{font-size:20px;display:block;margin-bottom:4px;}
.preset-btn:hover{border-color:var(--amber3);color:var(--text);}
.preset-btn.active{background:var(--amber3);border-color:var(--amber);color:var(--amber2);}

.input-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:16px;}
.dim-row{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:14px;}
@media(min-width:600px){.dim-row{grid-template-columns:repeat(4,1fr);}}
.field{display:flex;flex-direction:column;gap:5px;}
.field label{font-family:var(--ff-mono);font-size:9px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;}
.field input,.field select{background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--ff-mono);font-size:16px;font-weight:600;padding:9px 11px;width:100%;outline:none;transition:border-color .15s;-moz-appearance:textfield;}
.field input:focus,.field select:focus{border-color:var(--amber);}
.field input::-webkit-inner-spin-button{display:none;}

.expert-toggle{background:none;border:1px dashed var(--border);border-radius:4px;color:var(--text3);font-family:var(--ff-mono);font-size:10px;letter-spacing:1px;padding:7px 12px;cursor:pointer;width:100%;text-align:left;transition:all .15s;display:flex;justify-content:space-between;}
.expert-toggle:hover,.expert-toggle.open{border-color:var(--amber3);color:var(--amber);}
.expert-panel{margin-top:10px;padding:14px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
@media(min-width:600px){.expert-panel{grid-template-columns:repeat(3,1fr);}}
.ef{display:flex;flex-direction:column;gap:4px;font-family:var(--ff-mono);font-size:9px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;}
.ef input,.ef select{background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--ff-mono);font-size:13px;padding:6px 9px;outline:none;transition:border-color .15s;-moz-appearance:textfield;}
.ef input:focus,.ef select:focus{border-color:var(--amber);}
.ef input::-webkit-inner-spin-button{display:none;}

.stats-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;}
@media(min-width:600px){.stats-strip{grid-template-columns:repeat(6,1fr);}}
.stat-badge{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:10px 8px;text-align:center;}
.sv{font-family:var(--ff-head);font-size:18px;color:var(--amber2);letter-spacing:1px;line-height:1;}
.sl{font-family:var(--ff-mono);font-size:8px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-top:3px;}

.budget-wrap{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:20px;}
.tab-bar{display:flex;border-bottom:2px solid var(--border);}
.tab-btn{background:none;border:none;border-bottom:2px solid transparent;color:var(--text3);font-family:var(--ff-mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:9px 14px;cursor:pointer;margin-bottom:-2px;transition:all .15s;}
.tab-btn:hover{color:var(--text2);}
.tab-btn.active{color:var(--amber2);border-bottom-color:var(--amber2);}
.tab-btn-right{margin-left:auto;}

.btable{width:100%;border-collapse:collapse;font-size:12px;}
.btable thead tr{background:var(--bg3);border-bottom:1px solid var(--border);}
.btable th{font-family:var(--ff-mono);font-size:8px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;padding:9px 10px;text-align:left;}
.btable th:not(:first-child){text-align:right;}
.btable th:last-child{text-align:center;}
.cat-hdr td{font-family:var(--ff-mono);font-size:9px;letter-spacing:2px;text-transform:uppercase;padding:7px 10px 5px;color:var(--text3);background:var(--bg);border-bottom:1px solid var(--border);}
.lrow{border-bottom:1px solid var(--border);transition:background .1s;}
.lrow:hover{background:var(--bg3);}
.lrow td{padding:6px 8px;vertical-align:middle;}

.l-label-input{background:none;border:none;color:var(--text);font-family:var(--ff-body);font-size:12px;outline:none;width:100%;min-width:120px;padding:3px 5px;border-radius:3px;transition:background .15s;}
.l-label-input:hover{background:var(--bg4);}
.l-label-input:focus{background:var(--bg4);outline:1px solid var(--border2);}

.l-num-input{background:none;border:none;color:var(--text2);font-family:var(--ff-mono);font-size:11px;outline:none;text-align:right;width:72px;padding:3px 5px;border-radius:3px;transition:background .15s;-moz-appearance:textfield;}
.l-num-input:hover{background:var(--bg4);}
.l-num-input:focus{background:var(--bg4);color:var(--amber2);outline:1px solid var(--border2);}
.l-num-input::-webkit-inner-spin-button{display:none;}

/* FIX: unit select inline in table */
.l-unit-select{background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-family:var(--ff-mono);font-size:10px;padding:3px 4px;outline:none;cursor:pointer;transition:border-color .15s;width:72px;}
.l-unit-select:focus{border-color:var(--amber);color:var(--text);}

.l-total{font-family:var(--ff-mono);font-size:12px;color:var(--amber2);text-align:right;font-weight:600;white-space:nowrap;}
.l-del-btn{background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px 6px;border-radius:3px;transition:color .15s;display:block;margin:0 auto;}
.l-del-btn:hover{color:var(--red);}

.add-line-row td{padding:8px 10px;}
.add-line-btn{background:none;border:1px dashed var(--border);border-radius:4px;color:var(--text3);font-family:var(--ff-mono);font-size:10px;letter-spacing:1px;padding:6px 14px;cursor:pointer;transition:all .15s;}
.add-line-btn:hover{border-color:var(--amber3);color:var(--amber);}

.total-footer{background:var(--bg3);border-top:2px solid var(--amber3);padding:18px;}
.tr-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;}
.tr-label{font-family:var(--ff-mono);font-size:11px;color:var(--text2);}
.tr-value{font-family:var(--ff-mono);font-size:13px;color:var(--text);}
.tr-row.grand{border-top:1px solid var(--amber3);margin-top:10px;padding-top:12px;}
.tr-row.grand .tr-label{font-family:var(--ff-head);font-size:18px;letter-spacing:2px;color:var(--amber2);}
.tr-row.grand .tr-value{font-family:var(--ff-head);font-size:26px;color:var(--amber2);letter-spacing:2px;text-shadow:0 0 20px var(--amber3);}
.tr-per-m2{font-family:var(--ff-mono);font-size:9px;color:var(--text3);text-align:right;margin-top:8px;letter-spacing:1px;}

.toast{position:fixed;bottom:24px;right:24px;color:#fff;font-family:var(--ff-mono);font-size:12px;padding:10px 18px;border-radius:var(--r);z-index:999;letter-spacing:1px;pointer-events:none;}
.toast.ok{background:var(--green);}
.toast.err{background:var(--red);}
`;

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [calculations, setCalculations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [expertOpen, setExpertOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("material");

  // Current calc fields
  const [activeId, setActiveId]       = useState(null);
  const [calcName, setCalcName]       = useState(EMPTY_STATE.calcName);
  const [calcClient, setCalcClient]   = useState(EMPTY_STATE.calcClient);
  const [calcStatus, setCalcStatus]   = useState(EMPTY_STATE.calcStatus);
  const [length, setLength]           = useState(EMPTY_STATE.length);
  const [width, setWidth]             = useState(EMPTY_STATE.width);
  const [margin, setMargin]           = useState(EMPTY_STATE.margin);
  const [vatRate, setVatRate]         = useState(EMPTY_STATE.vatRate);
  const [preset, setPreset]           = useState(EMPTY_STATE.preset);
  const [config, setConfig]           = useState(EMPTY_STATE.config);
  const [lines, setLines]             = useState([]);
  const [linesEdited, setLinesEdited] = useState(false);

  // ---- Load list on mount ----
  useEffect(() => { loadList(); }, []);

  async function loadList() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("calculations")
      .select("id,name,client,status,area,subtotal,updated_at")
      .order("updated_at", { ascending: false });
    if (!error) setCalculations(data || []);
    setLoadingList(false);
  }

  // ---- Auto-recalc when params change (unless manually edited) ----
  useEffect(() => {
    if (linesEdited) return;
    if (!length || !width || length <= 0 || width <= 0) return;
    const newLines = buildLines({ length, width, config, margin }).map(l => ({
      ...l,
      id: uid(),
      calculation_id: activeId,
    }));
    setLines(newLines);
  }, [length, width, config, margin, linesEdited, activeId]);

  // ---- Load single calculation ----
  async function loadCalc(id) {
    const { data: calc } = await supabase.from("calculations").select("*").eq("id", id).single();
    const { data: lineData } = await supabase.from("calculation_lines").select("*").eq("calculation_id", id).order("sort_order");
    if (!calc) return;

    setActiveId(calc.id);
    setCalcName(calc.name);
    setCalcClient(calc.client || "");
    setCalcStatus(calc.status || "draft");
    setLength(parseFloat(calc.length));
    setWidth(parseFloat(calc.width));
    setMargin(parseFloat(calc.margin));
    setVatRate(parseFloat(calc.vat_rate));

    const cfg = calc.config || {};
    setConfig(cfg);
    const p = PRESETS.find(p => p.id === cfg.id) || DEFAULT_PRESET;
    setPreset(p);

    const loaded = (lineData || []).map(l => ({
      ...l,
      qty: parseFloat(l.qty),
      unit_price: parseFloat(l.unit_price),
      total: parseFloat(l.qty) * parseFloat(l.unit_price),
    }));
    setLines(loaded);
    setLinesEdited(true); // treat loaded lines as "final" — don't auto-overwrite
    setActiveTab("material");
    setExpertOpen(false);
  }

  // ---- New calc ----
  const handleNew = useCallback(() => {
    setActiveId(null);
    setCalcName("Nová kalkulace");
    setCalcClient("");
    setCalcStatus("draft");
    setLength(5);
    setWidth(4);
    setMargin(20);
    setVatRate(21);
    setPreset(DEFAULT_PRESET);
    setConfig({ ...DEFAULT_PRESET });
    setLinesEdited(false); // triggers auto-recalc via useEffect
    setExpertOpen(false);
    setActiveTab("material");
  }, []);

  // ---- Preset ----
  const applyPreset = useCallback((p) => {
    setPreset(p);
    setConfig({ ...p });
    setLinesEdited(false); // triggers auto-recalc
  }, []);

  // ---- Line editing ----
  const updateLine = useCallback((id, field, value) => {
    setLinesEdited(true);
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: field === "label" || field === "unit" ? value : parseFloat(value) || 0 };
      updated.total = parseFloat((updated.qty * updated.unit_price).toFixed(2));
      return updated;
    }));
  }, []);

  const deleteLine = useCallback((id) => {
    setLinesEdited(true);
    setLines(prev => prev.filter(l => l.id !== id));
  }, []);

  const addCustomLine = useCallback(() => {
    setLinesEdited(true);
    const newLine = {
      id: uid(),
      calculation_id: activeId,
      line_key: "custom_" + Date.now(),
      category: activeTab === "labor" ? "labor" : "material",
      label: "Vlastní položka",
      qty: 1,
      unit: "ks",
      unit_price: 0,
      total: 0,
      is_custom: true,
      is_deleted: false,
      sort_order: 99,
    };
    setLines(prev => [...prev, newLine]);
  }, [activeId, activeTab]);

  const handleRecalc = useCallback(() => {
    setLinesEdited(false);
  }, []);

  // ---- Computed totals ----
  const area = (length || 0) * (width || 0);
  const subtotal = lines.reduce((s, l) => s + (l.total || 0), 0);
  const vatAmount = subtotal * (vatRate / 100);
  const totalWithVat = subtotal + vatAmount;

  // ---- Save ----
  async function handleSave() {
    if (!calcName.trim()) { showToast("Zadejte název kalkulace", "err"); return; }
    setSaving(true);

    const calcData = {
      name: calcName.trim(),
      client: calcClient || null,
      status: calcStatus,
      length,
      width,
      margin,
      vat_rate: vatRate,
      config,
      area,
      subtotal,
      total_vat: vatAmount,
      weight_kg: null,
    };

    let calcId = activeId;

    if (!calcId) {
      const { data, error } = await supabase.from("calculations").insert(calcData).select().single();
      if (error) { showToast("❌ Chyba: " + error.message, "err"); setSaving(false); return; }
      calcId = data.id;
      setActiveId(calcId);
    } else {
      const { error } = await supabase.from("calculations").update(calcData).eq("id", calcId);
      if (error) { showToast("❌ Chyba: " + error.message, "err"); setSaving(false); return; }
    }

    // Delete old lines, insert fresh
    await supabase.from("calculation_lines").delete().eq("calculation_id", calcId);

    const linesToInsert = lines.map(({ id: _id, total: _t, ...rest }) => ({
      ...rest,
      calculation_id: calcId,
    }));

    if (linesToInsert.length > 0) {
      const { error } = await supabase.from("calculation_lines").insert(linesToInsert);
      if (error) { showToast("❌ Chyba při ukládání položek", "err"); setSaving(false); return; }
    }

    await loadList();
    setSaving(false);
    showToast("✓ Uloženo", "ok");
  }

  // ---- Delete ----
  async function handleDelete(id) {
    if (!window.confirm("Opravdu smazat tuto kalkulaci?")) return;
    await supabase.from("calculations").delete().eq("id", id);
    await loadList();
    if (activeId === id) handleNew();
    showToast("Smazáno", "ok");
  }

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  // ---- Filtered lines for table ----
  const matLines = lines.filter(l => l.category === "material");
  const labLines = lines.filter(l => l.category === "labor");
  const shownLines = activeTab === "material" ? matLines : activeTab === "labor" ? labLines : lines;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <style>{CSS}</style>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="shell">

        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sb-header">
            <div className="sb-logo">TERASA PRO</div>
            <div className="sb-sub">Kalkulátor · v1.2</div>
          </div>

          <button className="sb-new-btn" onClick={handleNew}>
            + NOVÁ KALKULACE
          </button>

          <div className="sb-section">Uložené kalkulace</div>

          <div className="calc-list">
            {loadingList && <div className="sb-empty">Načítání…</div>}
            {!loadingList && calculations.length === 0 && (
              <div className="sb-empty">Zatím žádné kalkulace.<br />Vytvořte první.</div>
            )}
            {calculations.map(c => (
              <div
                key={c.id}
                className={`calc-item ${activeId === c.id ? "active" : ""}`}
                onClick={() => loadCalc(c.id)}
              >
                <div className="ci-name">{c.name}</div>
                <div className="ci-meta">
                  <span>
                    <span className="status-dot" style={{ background: STATUS_COLORS[c.status] || "#666" }} />
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                  {c.client && <span>{c.client}</span>}
                  {c.area ? <span>{parseFloat(c.area).toFixed(1)} m²</span> : null}
                </div>
                {c.subtotal ? <div className="ci-total">{czk(c.subtotal)}</div> : null}
              </div>
            ))}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="main">

          {/* HEADER */}
          <div className="mh">
            <div className="mh-left">
              <input
                className="mh-title-input"
                value={calcName}
                onChange={e => setCalcName(e.target.value)}
                placeholder="Název kalkulace"
              />
              <input
                className="mh-client-input"
                value={calcClient}
                onChange={e => setCalcClient(e.target.value)}
                placeholder="Zákazník / akce (nepovinné)"
              />
            </div>
            <div className="mh-actions">
              <select className="status-select" value={calcStatus} onChange={e => setCalcStatus(e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="save-btn" onClick={handleSave} disabled={saving}>
                {saving ? "Ukládám…" : "💾 Uložit"}
              </button>
              {activeId && (
                <button className="del-btn" onClick={() => handleDelete(activeId)} title="Smazat kalkulaci">🗑</button>
              )}
            </div>
          </div>

          {/* 01 PRESET */}
          <div className="slabel">01 · Systém</div>
          <div className="preset-grid">
            {PRESETS.map(p => (
              <button
                key={p.id}
                className={`preset-btn ${preset.id === p.id ? "active" : ""}`}
                onClick={() => applyPreset(p)}
              >
                <span className="pi">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>

          {/* 02 DIMENSIONS */}
          <div className="slabel">02 · Rozměry a nastavení</div>
          <div className="input-card">
            <div className="dim-row">
              <div className="field">
                <label>Délka (m)</label>
                <input type="number" value={length} min={0.5} step={0.1}
                  onChange={e => { setLength(parseFloat(e.target.value) || 0); setLinesEdited(false); }} />
              </div>
              <div className="field">
                <label>Šířka (m)</label>
                <input type="number" value={width} min={0.5} step={0.1}
                  onChange={e => { setWidth(parseFloat(e.target.value) || 0); setLinesEdited(false); }} />
              </div>
              <div className="field">
                <label>Marže (%)</label>
                <input type="number" value={margin} min={0} max={80} step={5}
                  onChange={e => { setMargin(parseFloat(e.target.value) || 0); setLinesEdited(false); }} />
              </div>
              <div className="field">
                <label>Sazba DPH</label>
                <select value={vatRate} onChange={e => setVatRate(+e.target.value)}>
                  <option value={15}>15 % snížená</option>
                  <option value={21}>21 % základní</option>
                </select>
              </div>
            </div>

            <button
              className={`expert-toggle ${expertOpen ? "open" : ""}`}
              onClick={() => setExpertOpen(v => !v)}
            >
              <span>⚙ Expertní nastavení (rozpon, mezery, šrouby)</span>
              <span>{expertOpen ? "▲ Skrýt" : "▼ Zobrazit"}</span>
            </button>

            {expertOpen && (
              <div className="expert-panel">
                {[
                  ["Rozpon roštů (mm)",   "joistSpan",      300, 800, 50],
                  ["Rozteč podpor (mm)",  "supportSpacing", 400, 900, 50],
                  ["Šířka palubky (mm)",  "boardWidth",     80,  200, 5 ],
                  ["Mezera (mm)",         "gapMm",          3,   12,  1 ],
                  ["Šrouby / m²",        "screwsPerM2",    20,  60,  1 ],
                ].map(([label, key, min, max, step]) => (
                  <div className="ef" key={key}>
                    <span>{label}</span>
                    <input type="number" value={config[key] || ""} min={min} max={max} step={step}
                      onChange={e => { setConfig(c => ({ ...c, [key]: +e.target.value })); setLinesEdited(false); }} />
                  </div>
                ))}
                <div className="ef">
                  <span>Typ podpory</span>
                  <select value={config.usePedestals ? "yes" : "no"}
                    onChange={e => { setConfig(c => ({ ...c, usePedestals: e.target.value === "yes" })); setLinesEdited(false); }}>
                    <option value="yes">Rektifikační terče</option>
                    <option value="no">Betonové dlaždice</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 03 STATS */}
          {area > 0 && (
            <>
              <div className="slabel">03 · Výpočet</div>
              <div className="stats-strip">
                {[
                  ["Plocha",   `${area.toFixed(1)} m²`],
                  ["Palubky",  `${lines.find(l => l.line_key === "board")?.qty?.toFixed(0) || "—"} bm`],
                  ["Rošty",    `${lines.find(l => l.line_key === "joist")?.qty?.toFixed(0) || "—"} bm`],
                  ["Podpory",  `${lines.find(l => l.line_key === "support")?.qty || "—"} ks`],
                  ["Šrouby",   `${lines.find(l => l.line_key === "screw")?.qty || "—"} ks`],
                  ["Položky",  lines.length],
                ].map(([label, value]) => (
                  <div key={label} className="stat-badge">
                    <div className="sv">{value}</div>
                    <div className="sl">{label}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 04 BUDGET */}
          <div className="slabel">
            04 · Položkový rozpočet
            {linesEdited && (
              <span style={{ color: "var(--amber)", fontSize: 9, marginLeft: 6, fontFamily: "var(--ff-mono)", letterSpacing: 1 }}>
                · UPRAVENO RUČNĚ
              </span>
            )}
          </div>

          <div className="budget-wrap">
            <div className="tab-bar">
              {[["material", "Materiál"], ["labor", "Práce"], ["all", "Vše"]].map(([k, l]) => (
                <button key={k} className={`tab-btn ${activeTab === k ? "active" : ""}`} onClick={() => setActiveTab(k)}>{l}</button>
              ))}
              <button className="tab-btn tab-btn-right" onClick={handleRecalc} title="Přepočítat z parametrů">
                🔄 Přepočítat
              </button>
            </div>

            <table className="btable">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Položka</th>
                  <th>Množství</th>
                  <th>Jednotka</th>
                  <th>Cena/j.</th>
                  <th>Celkem</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeTab !== "labor" && (
                  <tr className="cat-hdr"><td colSpan={6}>▸ MATERIÁL</td></tr>
                )}
                {(activeTab === "all" || activeTab === "material") && matLines.map(l => (
                  <LineRow key={l.id} line={l} onUpdate={updateLine} onDelete={deleteLine} />
                ))}
                {activeTab !== "material" && (
                  <tr className="cat-hdr"><td colSpan={6}>▸ PRÁCE & LOGISTIKA</td></tr>
                )}
                {(activeTab === "all" || activeTab === "labor") && labLines.map(l => (
                  <LineRow key={l.id} line={l} onUpdate={updateLine} onDelete={deleteLine} />
                ))}
                <tr className="add-line-row">
                  <td colSpan={6}>
                    <button className="add-line-btn" onClick={addCustomLine}>
                      + Přidat vlastní položku
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="total-footer">
              <div className="tr-row">
                <span className="tr-label">Cena bez DPH</span>
                <span className="tr-value">{czk(subtotal)}</span>
              </div>
              <div className="tr-row">
                <span className="tr-label">DPH {vatRate} %</span>
                <span className="tr-value">{czk(vatAmount)}</span>
              </div>
              <div className="tr-row grand">
                <span className="tr-label">CELKEM S DPH</span>
                <span className="tr-value">{czk(totalWithVat)}</span>
              </div>
              {area > 0 && (
                <div className="tr-per-m2">
                  {czk(subtotal / area)}/m² bez DPH · {czk(totalWithVat / area)}/m² s DPH
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </>
  );
}

// ============================================================
// LINE ROW COMPONENT
// ============================================================
function LineRow({ line, onUpdate, onDelete }) {
  return (
    <tr className="lrow">
      <td>
        <input
          className="l-label-input"
          value={line.label}
          onChange={e => onUpdate(line.id, "label", e.target.value)}
        />
      </td>
      <td style={{ textAlign: "right" }}>
        <input
          className="l-num-input"
          type="number"
          value={line.qty}
          onChange={e => onUpdate(line.id, "qty", e.target.value)}
        />
      </td>
      <td style={{ textAlign: "right" }}>
        {/* FIX: unit is now a select, not static text */}
        <select
          className="l-unit-select"
          value={line.unit}
          onChange={e => onUpdate(line.id, "unit", e.target.value)}
        >
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td style={{ textAlign: "right" }}>
        <input
          className="l-num-input"
          type="number"
          value={line.unit_price}
          onChange={e => onUpdate(line.id, "unit_price", e.target.value)}
        />
      </td>
      <td className="l-total">{czk(line.total)}</td>
      <td style={{ textAlign: "center" }}>
        <button className="l-del-btn" onClick={() => onDelete(line.id)} title="Smazat řádek">×</button>
      </td>
    </tr>
  );
}
