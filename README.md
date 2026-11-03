# World Simulator OSM

A mobile-friendly, spectator-only global strategy simulation prototype. Every nation is AI-controlled; the visitor observes the world.

## Current prototype
- World map with OpenStreetMap raster tiles and Natural Earth country boundaries from `world-atlas`.
- Nation directory, selected nation profile, event feed, simulation clock and speed controls.
- Deterministic time-based prototype state: the displayed simulation tick is derived from wall-clock time, so the timeline advances while the page is closed and catches up when reopened.
- No user-controlled faction and no external AI API key required.

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Important limitations
This first deployment is a front-end prototype. The simulated nation metrics and event feed are illustrative and deterministic, not a validated geopolitical forecast. It does not yet persist authoritative world state in a server database or run a continuously executing worker. A later backend phase is required for shared live state across devices, real AI decision cycles, wars that change borders, and a durable event history.

## Map data and attribution
- Map tiles: © OpenStreetMap contributors. Tile usage must follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- Country boundaries: `world-atlas` / Natural Earth. Verify and retain upstream dataset licensing/attribution when redistributing modified boundary data.

## License
Application source: MIT.
