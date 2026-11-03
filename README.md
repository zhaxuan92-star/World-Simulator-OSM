# World Simulator OSM

Spectator-only global strategy simulation prototype. Every nation is intended to be governed by an autonomous agent; visitors observe the world rather than command a faction.

## Current prototype (0.2.0)
- OpenStreetMap raster basemap with Natural Earth country boundaries.
- Nation directory and selectable country profiles.
- Military system design: personnel, armor, aircraft, naval vessels, artillery, readiness, logistics, military branches and installation records.
- AI profile design: personality, strategic doctrine, aggression, diplomacy, economic priority, risk tolerance and a four-stage decision pipeline.
- Conquest-engine blueprint: adjacency, war decision, frontline simulation and audited territorial control changes.
- Diplomacy framework: alliances, trade, negotiations, sanctions, ceasefires and treaty register.
- Mobile-responsive observer interface.

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Simulation status and limitations
This release is a systems-design prototype. Country force inventories, base locations, AI profiles, treaty records and event feed are illustrative seed data. They are not verified current military intelligence, and no live combat, autonomous agent execution, territorial conquest or persistent diplomacy is active yet.

The next engineering milestones are:
1. Normalize country, force, base, AI-agent and treaty records into a shared database schema.
2. Implement deterministic AI decision cycles and auditable action logs.
3. Build geographic adjacency and a territorial-control layer.
4. Implement conflict resolution, supply/readiness costs and border changes.
5. Persist world state and run simulation ticks in a durable background worker.

## Map attribution
- Map tiles: © OpenStreetMap contributors. Follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- Country boundaries: `world-atlas` / Natural Earth. Retain upstream data attribution and license notices when redistributing.

## License
Application source: MIT.
