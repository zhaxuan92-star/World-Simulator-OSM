import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";

type Country = { id: string; name: string; region: string; color: string; power: number; stability: number; relations: number; population: number; budget: number; };
type EventItem = { id: number; tick: number; title: string; detail: string; kind: "diplomacy" | "military" | "economy"; };
type Army = { countryId: string; personnel: number; tanks: number; aircraft: number; ships: number; artillery: number; readiness: number; logistics: number; doctrine: string; };
type Base = { name: string; countryId: string; type: "Army HQ" | "Air Base" | "Naval Base" | "Logistics Hub"; location: string; capacity: number; status: "Operational" | "Expanding" | "Reserve"; };
type AIProfile = { countryId: string; personality: string; doctrine: string; aggression: number; diplomacy: number; economy: number; risk: number; priority: string; };
type Section = "military" | "intelligence" | "war" | "diplomacy";

const initialCountries: Country[] = [
  { id: "840", name: "United States", region: "North America", color: "#3977d5", power: 86, stability: 76, relations: 48, population: 335, budget: 916 },
  { id: "156", name: "China", region: "Asia", color: "#d94c4c", power: 92, stability: 81, relations: 32, population: 1410, budget: 296 },
  { id: "643", name: "Russia", region: "Europe / Asia", color: "#a56bd6", power: 77, stability: 63, relations: 22, population: 144, budget: 109 },
  { id: "356", name: "India", region: "Asia", color: "#d99b3d", power: 69, stability: 73, relations: 57, population: 1428, budget: 83 },
  { id: "276", name: "Germany", region: "Europe", color: "#4ca58b", power: 54, stability: 82, relations: 71, population: 84, budget: 88 },
  { id: "076", name: "Brazil", region: "South America", color: "#4eaa65", power: 48, stability: 68, relations: 64, population: 216, budget: 23 },
  { id: "392", name: "Japan", region: "Asia", color: "#df79a2", power: 52, stability: 88, relations: 69, population: 124, budget: 50 },
  { id: "710", name: "South Africa", region: "Africa", color: "#c6a84a", power: 34, stability: 61, relations: 59, population: 62, budget: 3.5 }
];
const armies: Army[] = [
  { countryId: "840", personnel: 1328000, tanks: 4500, aircraft: 5200, ships: 490, artillery: 1550, readiness: 91, logistics: 94, doctrine: "Joint force projection" },
  { countryId: "156", personnel: 2035000, tanks: 5000, aircraft: 3300, ships: 730, artillery: 4100, readiness: 88, logistics: 86, doctrine: "Active defense / A2-AD" },
  { countryId: "643", personnel: 1320000, tanks: 5600, aircraft: 4100, ships: 300, artillery: 4900, readiness: 76, logistics: 68, doctrine: "Strategic depth" },
  { countryId: "356", personnel: 1455000, tanks: 4600, aircraft: 2200, ships: 290, artillery: 3300, readiness: 79, logistics: 72, doctrine: "Integrated deterrence" },
  { countryId: "276", personnel: 181000, tanks: 300, aircraft: 600, ships: 65, artillery: 120, readiness: 83, logistics: 91, doctrine: "Collective defense" },
  { countryId: "076", personnel: 360000, tanks: 170, aircraft: 220, ships: 45, artillery: 280, readiness: 61, logistics: 58, doctrine: "Regional defense" },
  { countryId: "392", personnel: 247000, tanks: 500, aircraft: 1450, ships: 155, artillery: 300, readiness: 89, logistics: 93, doctrine: "Maritime denial" },
  { countryId: "710", personnel: 78000, tanks: 150, aircraft: 220, ships: 40, artillery: 180, readiness: 57, logistics: 52, doctrine: "Territorial security" }
];
const bases: Base[] = [
  { name: "Norfolk Joint Command", countryId: "840", type: "Naval Base", location: "Virginia, Atlantic", capacity: 92, status: "Operational" },
  { name: "Ramstein Air Command", countryId: "276", type: "Air Base", location: "Central Europe", capacity: 88, status: "Operational" },
  { name: "Western Theater HQ", countryId: "156", type: "Army HQ", location: "Western China", capacity: 86, status: "Operational" },
  { name: "Eastern Logistics Network", countryId: "643", type: "Logistics Hub", location: "Western Russia", capacity: 71, status: "Expanding" },
  { name: "Yokosuka Fleet Base", countryId: "392", type: "Naval Base", location: "Tokyo Bay", capacity: 90, status: "Operational" },
  { name: "Central Command Depot", countryId: "356", type: "Logistics Hub", location: "Northern India", capacity: 74, status: "Operational" },
  { name: "Brasilia Defense HQ", countryId: "076", type: "Army HQ", location: "Central Brazil", capacity: 62, status: "Reserve" },
  { name: "Pretoria Air Station", countryId: "710", type: "Air Base", location: "Gauteng", capacity: 49, status: "Operational" }
];
const aiProfiles: AIProfile[] = [
  { countryId: "840", personality: "Strategic / pragmatic", doctrine: "Alliance leadership", aggression: 52, diplomacy: 86, economy: 76, risk: 44, priority: "Maintain alliances and sea lanes" },
  { countryId: "156", personality: "Patient / assertive", doctrine: "Long-term influence", aggression: 61, diplomacy: 68, economy: 94, risk: 48, priority: "Secure trade and regional influence" },
  { countryId: "643", personality: "Cautious / security-first", doctrine: "Strategic buffer", aggression: 73, diplomacy: 42, economy: 61, risk: 69, priority: "Protect strategic depth" },
  { countryId: "356", personality: "Pragmatic / independent", doctrine: "Multi-alignment", aggression: 43, diplomacy: 78, economy: 83, risk: 39, priority: "Expand economic and regional autonomy" },
  { countryId: "276", personality: "Cooperative / rules-based", doctrine: "Collective security", aggression: 25, diplomacy: 92, economy: 79, risk: 22, priority: "Strengthen collective defense" },
  { countryId: "076", personality: "Balanced / regional", doctrine: "Continental cooperation", aggression: 31, diplomacy: 73, economy: 70, risk: 28, priority: "Stabilize regional partnerships" },
  { countryId: "392", personality: "Defensive / technological", doctrine: "Maritime security", aggression: 29, diplomacy: 88, economy: 85, risk: 25, priority: "Protect maritime approaches" },
  { countryId: "710", personality: "Prudent / developmental", doctrine: "Regional stability", aggression: 22, diplomacy: 69, economy: 82, risk: 19, priority: "Improve domestic resilience" }
];
const treaties = [
  { name: "Collective Security Framework", members: "United States · Germany · Japan", type: "Defense pact", stability: "High" },
  { name: "Indo-Pacific Trade Dialogue", members: "China · India · Japan", type: "Trade dialogue", stability: "Negotiating" },
  { name: "Southern Development Forum", members: "Brazil · South Africa · India", type: "Economic cooperation", stability: "Active" }
];
const seedEvents = [
  ["Defence review completed", "Military planners publish a revised readiness assessment.", "military"],
  ["Diplomatic channel reopened", "Two governments resume formal communication.", "diplomacy"],
  ["Supply network upgraded", "A logistics command reports improved transport capacity.", "economy"],
  ["Regional exercise announced", "Several armed forces schedule a joint readiness exercise.", "military"],
  ["Trade framework proposed", "A new regional economic framework enters discussion.", "diplomacy"],
  ["Industrial output rises", "Manufacturing indicators improve across several economies.", "economy"]
] as const;
function stableHash(n: number) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function tickNow() { return Math.floor(Date.now() / 30000); }
function MapResize() { const map = useMap(); useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 250); return () => clearTimeout(t); }, [map]); return null; }
function number(value: number) { return new Intl.NumberFormat("en-US").format(value); }
function Meter({ label, value, color = "#65b5e8" }: { label: string; value: number; color?: string }) {
  return <div className="meter-wrap"><div className="meter-label"><span>{label}</span><b>{value}%</b></div><div className="bar"><i style={{ width: value + "%", background: color }} /></div></div>;
}

export default function App() {
  const [tick, setTick] = useState(tickNow());
  const [selectedId, setSelectedId] = useState("840");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<Section>("military");
  useEffect(() => { const timer = window.setInterval(() => { if (!paused) setTick(tickNow()); }, 1000); return () => clearInterval(timer); }, [paused]);
  const countries = useMemo(() => initialCountries.map((c, i) => ({
    ...c,
    power: Math.max(10, Math.min(100, c.power + Math.round((stableHash(tick * speed + i * 13) - .5) * 4))),
    stability: Math.max(15, Math.min(100, c.stability + Math.round((stableHash(tick * speed + i * 31) - .5) * 3))),
    relations: Math.max(0, Math.min(100, c.relations + Math.round((stableHash(tick * speed + i * 47) - .5) * 3)))
  })), [tick, speed]);
  const selected = countries.find(c => c.id === selectedId) ?? countries[0];
  const army = armies.find(a => a.countryId === selectedId) ?? armies[0];
  const ai = aiProfiles.find(a => a.countryId === selectedId) ?? aiProfiles[0];
  const countryName = (id: string) => initialCountries.find(c => c.id === id)?.name ?? id;
  const events: EventItem[] = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const t = tick - i;
    const e = seedEvents[Math.floor(stableHash(t + 900) * seedEvents.length)];
    return { id: t, tick: t, title: e[0], detail: e[1], kind: e[2] };
  }), [tick]);
  const geo = useMemo(() => feature(worldData as any, (worldData as any).objects.countries) as GeoJsonObject, []);
  const countryById = useMemo(() => new Map(countries.map(c => [c.id, c])), [countries]);
  const filtered = countries.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const formatTick = new Date(tick * 30000).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "medium" });
  return <main className="shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">🌐</div><div><strong>WORLD SIMULATOR</strong><small>OSM • AUTONOMOUS WORLD</small></div></div>
      <div className="live"><span className="pulse" /> SIMULATION PROTOTYPE</div>
    </header>
    <section className="statusbar">
      <div><small>WORLD CLOCK</small><strong>{formatTick}</strong></div>
      <div><small>SIMULATION TICK</small><strong>#{tick.toLocaleString("en-US")}</strong></div>
      <div><small>OBSERVERS</small><strong>1</strong></div>
      <div><small>ACTIVE NATIONS</small><strong>195</strong></div>
    </section>
    <section className="workspace">
      <div className="map-panel">
        <div className="map-heading"><div><span className="eyebrow">GLOBAL THEATER</span><h1>World overview</h1></div><span className="map-tag">EARTH / 2D</span></div>
        <div className="map-wrap"><MapContainer center={[22, 8]} zoom={2} minZoom={2} maxZoom={7} worldCopyJump scrollWheelZoom>
          <MapResize />
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <GeoJSON data={geo} style={(f) => {
            const c = countryById.get(String(f?.id ?? ""));
            return { color: "#8da2b8", weight: .65, fillColor: c?.color ?? "#26384c", fillOpacity: c ? .48 : .16 };
          }} onEachFeature={(f, layer) => {
            const c = countryById.get(String(f.id ?? ""));
            if (c) layer.bindTooltip(c.name, { sticky: true });
          }} />
        </MapContainer><div className="map-legend"><span><i className="legend-dot" /> Nation data preview</span><span><i className="legend-line" /> International border</span></div></div>
        <div className="map-controls"><button onClick={() => setPaused(!paused)}>{paused ? "▶ Resume" : "Ⅱ Pause"}</button><div className="speed-control"><span>TIME SCALE</span>{[1, 2, 5, 10].map(v => <button className={speed === v ? "active" : ""} key={v} onClick={() => setSpeed(v)}>{v}×</button>)}</div><span className="observer-label">SPECTATOR MODE · AI CONTROLS ALL NATIONS</span></div>
      </div>
      <aside className="side-panel">
        <div className="panel-title"><div><span className="eyebrow">INTELLIGENCE</span><h2>Nation directory</h2></div><span className="count">{countries.length}</span></div>
        <input className="search" placeholder="Search simulated nations..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="nation-list">{filtered.map(c => <button key={c.id} className={selectedId === c.id ? "nation selected" : "nation"} onClick={() => setSelectedId(c.id)}><span className="flag" style={{ background: c.color }} /><span className="nation-name"><b>{c.name}</b><small>{c.region}</small></span><span className="power">{c.power}<small>POWER</small></span></button>)}</div>
        <div className="selected-card"><span className="eyebrow">NATION PROFILE</span><h3><i style={{ background: selected.color }} />{selected.name}</h3><div className="metric"><span>Military / national power</span><b>{selected.power}/100</b></div><div className="bar"><i style={{ width: selected.power + "%", background: selected.color }} /></div><div className="metric"><span>Internal stability</span><b>{selected.stability}/100</b></div><div className="bar"><i style={{ width: selected.stability + "%" }} /></div><div className="metric"><span>Diplomatic relations</span><b>{selected.relations}/100</b></div><div className="bar"><i style={{ width: selected.relations + "%" }} /></div></div>
      </aside>
    </section>
    <section className="design-panel">
      <div className="design-header"><div><span className="eyebrow">WORLD SYSTEMS LAB</span><h2>National systems</h2><p>Military structure, autonomous decision intelligence and international relations</p></div><span className="prototype-tag">PHASE 01 · DESIGN</span></div>
      <nav className="system-tabs" aria-label="World systems">
        <button className={section === "military" ? "active" : ""} onClick={() => setSection("military")}>⚔ Military</button>
        <button className={section === "intelligence" ? "active" : ""} onClick={() => setSection("intelligence")}>◈ AI intelligence</button>
        <button className={section === "war" ? "active" : ""} onClick={() => setSection("war")}>▦ Conquest engine</button>
        <button className={section === "diplomacy" ? "active" : ""} onClick={() => setSection("diplomacy")}>◎ Diplomacy</button>
      </nav>
      {section === "military" && <div className="system-content">
        <div className="section-intro"><div><span className="eyebrow">ARMED FORCES / ORDER OF BATTLE</span><h3>{selected.name} · Military structure</h3><p>Abstract strategic force inventory for the world simulation. Figures are prototype values, not live intelligence.</p></div><span className="status-pill">● FORCE MODEL</span></div>
        <div className="force-grid">
          <article className="force-card"><span className="force-icon">♟</span><small>ACTIVE PERSONNEL</small><b>{number(army.personnel)}</b><em>Personnel</em></article>
          <article className="force-card"><span className="force-icon">▣</span><small>ARMORED VEHICLES</small><b>{number(army.tanks)}</b><em>Tanks / AFVs</em></article>
          <article className="force-card"><span className="force-icon">✈</span><small>AIRCRAFT</small><b>{number(army.aircraft)}</b><em>Combat + support</em></article>
          <article className="force-card"><span className="force-icon">⚓</span><small>NAVAL VESSELS</small><b>{number(army.ships)}</b><em>Major vessels</em></article>
          <article className="force-card"><span className="force-icon">▤</span><small>ARTILLERY</small><b>{number(army.artillery)}</b><em>Artillery systems</em></article>
        </div>
        <div className="two-column">
          <article className="subpanel"><div className="subpanel-title"><div><span className="eyebrow">READINESS</span><h4>Force condition</h4></div><span className="count">01</span></div><Meter label="Operational readiness" value={army.readiness} color="#6bc79b" /><Meter label="Logistics capacity" value={army.logistics} color="#65b5e8" /><div className="doctrine-line"><span>Military doctrine</span><b>{army.doctrine}</b></div><div className="doctrine-line"><span>Annual defense budget</span><b>{armyBudget( selected.budget )}</b></div></article>
          <article className="subpanel"><div className="subpanel-title"><div><span className="eyebrow">FORCE DESIGN</span><h4>Military branches</h4></div><span className="count">05</span></div><div className="branch-row"><span>Land forces</span><b>Army</b><small>Ground defense and maneuver</small></div><div className="branch-row"><span>Air forces</span><b>Air Force</b><small>Airspace control and support</small></div><div className="branch-row"><span>Naval forces</span><b>Navy</b><small>Sea control and maritime security</small></div><div className="branch-row"><span>Strategic support</span><b>Logistics</b><small>Transport, supply and maintenance</small></div><div className="branch-row"><span>Digital defense</span><b>Cyber</b><small>Communications and infrastructure</small></div></article>
        </div>
        <article className="subpanel base-panel"><div className="subpanel-title"><div><span className="eyebrow">INSTALLATIONS NETWORK</span><h4>Military bases and infrastructure</h4></div><span className="count">{bases.filter(b => b.countryId === selectedId).length} shown</span></div><div className="base-grid">{bases.filter(b => b.countryId === selectedId).map(b => <div className="base-item" key={b.name}><div className="base-symbol">{b.type === "Naval Base" ? "⚓" : b.type === "Air Base" ? "✈" : b.type === "Army HQ" ? "⌖" : "▤"}</div><div className="base-info"><b>{b.name}</b><small>{b.type} · {b.location}</small><div className="base-progress"><i style={{ width: b.capacity + "%" }} /></div></div><span className={b.status === "Operational" ? "base-status operational" : "base-status"}>{b.status}</span></div>)}{bases.filter(b => b.countryId === selectedId).length === 0 && <p className="muted">No base records for this nation yet.</p>}</div></article>
      </div>}
      {section === "intelligence" && <div className="system-content">
        <div className="section-intro"><div><span className="eyebrow">AUTONOMOUS GOVERNMENT / AGENT PROFILE</span><h3>{selected.name} · AI decision profile</h3><p>Each country receives an independent strategic personality and evaluates its own national interests.</p></div><span className="status-pill">● AI PROFILE</span></div>
        <div className="ai-identity"><div className="ai-avatar">◈</div><div><small>GOVERNMENT PERSONALITY</small><h3>{ai.personality}</h3><p>Strategic doctrine: <b>{ai.doctrine}</b></p></div></div>
        <div className="two-column"><article className="subpanel"><div className="subpanel-title"><div><span className="eyebrow">DECISION WEIGHTS</span><h4>Behavior parameters</h4></div></div><Meter label="Aggression / military assertiveness" value={ai.aggression} color="#e58d82" /><Meter label="Diplomatic preference" value={ai.diplomacy} color="#b69be9" /><Meter label="Economic development priority" value={ai.economy} color="#70c99e" /><Meter label="Risk tolerance" value={ai.risk} color="#e7bd6b" /></article><article className="subpanel"><div className="subpanel-title"><div><span className="eyebrow">CURRENT STRATEGIC GOAL</span><h4>National priority</h4></div></div><div className="priority-card"><span>PRIMARY OBJECTIVE</span><b>{ai.priority}</b><p>The agent weighs security, economic health, internal stability, alliances and the likely cost of escalation before choosing an action.</p></div><div className="doctrine-line"><span>Decision cycle</span><b>Observe → Evaluate → Act → Review</b></div></article></div>
        <article className="subpanel"><div className="subpanel-title"><div><span className="eyebrow">AGENT DECISION PIPELINE</span><h4>How the AI governs</h4></div></div><div className="pipeline"><div><b>01 · Observe</b><small>Read borders, resources, threats, treaties and public stability.</small></div><div><b>02 · Evaluate</b><small>Score national interests, costs, risks and opportunities.</small></div><div><b>03 · Decide</b><small>Select diplomacy, investment, mobilization or de-escalation.</small></div><div><b>04 · Execute</b><small>Apply the decision to the shared world state and log the event.</small></div></div></article>
      </div>}
      {section === "war" && <div className="system-content"><div className="section-intro"><div><span className="eyebrow">TERRITORIAL CONTROL / CONFLICT SIMULATION</span><h3>Conquest engine blueprint</h3><p>This is the next implementation stage. The current map remains a geographic reference; borders are not being changed yet.</p></div><span className="status-pill pending">○ NEXT PHASE</span></div><div className="war-steps"><article><span>01</span><b>Border adjacency</b><p>Build a neighbor graph from country polygons so only connected territories can be contested.</p></article><article><span>02</span><b>War declarations</b><p>AI evaluates threat, military balance, treaties, economy and escalation risk before conflict.</p></article><article><span>03</span><b>Frontline simulation</b><p>Abstract land, air and naval operations consume supply, readiness and manpower.</p></article><article><span>04</span><b>Territorial change</b><p>Control changes only after a simulated campaign outcome and is written to persistent state.</p></article></div><div className="notice"><b>Simulation integrity</b><p>We will not randomly recolor countries as if a conquest happened. A territory change must come from a logged conflict outcome, with a clear before/after record.</p></div></div>}
      {section === "diplomacy" && <div className="system-content"><div className="section-intro"><div><span className="eyebrow">FOREIGN POLICY / INTERNATIONAL SYSTEM</span><h3>Diplomatic relations</h3><p>AI governments will maintain bilateral relations, alliances, treaties, trade agreements and ceasefires.</p></div><span className="status-pill pending">○ FRAMEWORK</span></div><div className="diplomacy-grid"><article className="subpanel"><div className="subpanel-title"><div><span className="eyebrow">TREATY REGISTER</span><h4>International agreements</h4></div><span className="count">{treaties.length}</span></div>{treaties.map(t => <div className="treaty" key={t.name}><div><b>{t.name}</b><small>{t.members}</small></div><span><em>{t.type}</em><strong>{t.stability}</strong></span></div>)}</article><article className="subpanel"><div className="subpanel-title"><div><span className="eyebrow">DIPLOMATIC ACTIONS</span><h4>Available AI actions</h4></div></div><div className="branch-row"><span>Alliance</span><b>Mutual defense pact</b><small>Formal commitment to collective security</small></div><div className="branch-row"><span>Trade</span><b>Economic agreement</b><small>Tariffs, access and strategic resources</small></div><div className="branch-row"><span>Relations</span><b>Embassy / negotiation</b><small>Improve or repair bilateral relations</small></div><div className="branch-row"><span>Conflict</span><b>Ceasefire / peace treaty</b><small>Stop hostilities and define settlement</small></div><div className="branch-row"><span>Pressure</span><b>Sanctions / embargo</b><small>Non-military diplomatic pressure</small></div></article></div></div>}
    </section>
    <section className="bottom-panel"><div className="panel-title"><div><span className="eyebrow">WORLD TELEMETRY</span><h2>Recent developments</h2></div><span className="live-mini">● SIMULATION FEED</span></div><div className="event-grid">{events.slice(0, 4).map(e => <article className="event" key={e.id}><span className={"event-type " + e.kind}>{e.kind.toUpperCase()}</span><b>{e.title}</b><p>{e.detail}</p><small>SIM TICK #{e.tick.toLocaleString("en-US")}</small></article>)}</div></section>
    <footer><span>WORLD SIMULATOR OSM · SYSTEMS PROTOTYPE 0.2.0</span><span>Map tiles © OpenStreetMap contributors · Boundaries: world-atlas / Natural Earth</span></footer>
  </main>;
}
function armyBudget(value: number) { return "$" + value + "B / year (illustrative)"; }
