import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";

type Country = { id: string; name: string; region: string; color: string; power: number; stability: number; relations: number; };
type EventItem = { id: number; tick: number; title: string; detail: string; kind: "diplomacy" | "military" | "economy"; };
const initialCountries: Country[] = [
  { id: "840", name: "United States", region: "North America", color: "#3977d5", power: 86, stability: 76, relations: 48 },
  { id: "156", name: "China", region: "Asia", color: "#d94c4c", power: 92, stability: 81, relations: 32 },
  { id: "643", name: "Russia", region: "Europe / Asia", color: "#a56bd6", power: 77, stability: 63, relations: 22 },
  { id: "356", name: "India", region: "Asia", color: "#d99b3d", power: 69, stability: 73, relations: 57 },
  { id: "276", name: "Germany", region: "Europe", color: "#4ca58b", power: 54, stability: 82, relations: 71 },
  { id: "076", name: "Brazil", region: "South America", color: "#4eaa65", power: 48, stability: 68, relations: 64 },
  { id: "392", name: "Japan", region: "Asia", color: "#df79a2", power: 52, stability: 88, relations: 69 },
  { id: "710", name: "South Africa", region: "Africa", color: "#c6a84a", power: 34, stability: 61, relations: 59 }
];
const seedEvents = [
  ["Diplomatic summit opens in Geneva", "Major powers begin a new round of negotiations.", "diplomacy"],
  ["Defence spending increases", "Several governments approve a revised military budget.", "military"],
  ["Trade corridor agreement signed", "A regional economic pact enters its implementation phase.", "economy"],
  ["Border tensions reported", "Military observers report a rise in readiness near a disputed frontier.", "military"],
  ["Ceasefire proposal circulated", "Diplomats are attempting to reduce regional tensions.", "diplomacy"],
  ["Industrial output rises", "Manufacturing indicators improve across several economies.", "economy"]
] as const;
function stableHash(n: number) { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function tickNow() { return Math.floor(Date.now() / 30000); }
function MapResize() { const map = useMap(); useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 250); return () => clearTimeout(t); }, [map]); return null; }

export default function App() {
  const [tick, setTick] = useState(tickNow());
  const [selected, setSelected] = useState<Country>(initialCountries[0]);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => { const timer = window.setInterval(() => { if (!paused) setTick(tickNow()); }, 1000); return () => clearInterval(timer); }, [paused]);
  const countries = useMemo(() => initialCountries.map((c, i) => ({
    ...c,
    power: Math.max(10, Math.min(100, c.power + Math.round((stableHash(tick * speed + i * 13) - .5) * 4))),
    stability: Math.max(15, Math.min(100, c.stability + Math.round((stableHash(tick * speed + i * 31) - .5) * 3))),
    relations: Math.max(0, Math.min(100, c.relations + Math.round((stableHash(tick * speed + i * 47) - .5) * 3)))
  })), [tick, speed]);
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
      <div className="live"><span className="pulse" /> SIMULATION LIVE</div>
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
        </MapContainer><div className="map-legend"><span><i className="legend-dot" /> Simulated nation</span><span><i className="legend-line" /> International border</span></div></div>
        <div className="map-controls"><button onClick={() => setPaused(!paused)}>{paused ? "▶ Resume" : "Ⅱ Pause"}</button><div className="speed-control"><span>TIME SCALE</span>{[1, 2, 5, 10].map(v => <button className={speed === v ? "active" : ""} key={v} onClick={() => setSpeed(v)}>{v}×</button>)}</div><span className="observer-label">SPECTATOR MODE · AI CONTROLS ALL NATIONS</span></div>
      </div>
      <aside className="side-panel">
        <div className="panel-title"><div><span className="eyebrow">INTELLIGENCE</span><h2>Nation directory</h2></div><span className="count">{countries.length}</span></div>
        <input className="search" placeholder="Search simulated nations..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="nation-list">{filtered.map(c => <button key={c.id} className={selected.id === c.id ? "nation selected" : "nation"} onClick={() => setSelected(c)}><span className="flag" style={{ background: c.color }} /><span className="nation-name"><b>{c.name}</b><small>{c.region}</small></span><span className="power">{c.power}<small>POWER</small></span></button>)}</div>
        <div className="selected-card"><span className="eyebrow">NATION PROFILE</span><h3><i style={{ background: selected.color }} />{selected.name}</h3><div className="metric"><span>Military / national power</span><b>{selected.power}/100</b></div><div className="bar"><i style={{ width: selected.power + "%", background: selected.color }} /></div><div className="metric"><span>Internal stability</span><b>{selected.stability}/100</b></div><div className="bar"><i style={{ width: selected.stability + "%" }} /></div><div className="metric"><span>Diplomatic relations</span><b>{selected.relations}/100</b></div><div className="bar"><i style={{ width: selected.relations + "%" }} /></div></div>
      </aside>
    </section>
    <section className="bottom-panel"><div className="panel-title"><div><span className="eyebrow">WORLD TELEMETRY</span><h2>Recent developments</h2></div><span className="live-mini">● LIVE FEED</span></div><div className="event-grid">{events.slice(0, 4).map(e => <article className="event" key={e.id}><span className={"event-type " + e.kind}>{e.kind.toUpperCase()}</span><b>{e.title}</b><p>{e.detail}</p><small>SIM TICK #{e.tick.toLocaleString("en-US")}</small></article>)}</div></section>
    <footer><span>WORLD SIMULATOR OSM · PROTOTYPE 0.1.0</span><span>Map tiles © OpenStreetMap contributors · Boundaries: world-atlas / Natural Earth</span></footer>
  </main>;
}