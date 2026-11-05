# World Simulator OSM — Official Release

World Simulator is a browser-based global strategy sandbox. It simulates sovereign countries, borders, autonomous governments, military campaigns, diplomacy, research, and a civilian economy.

## Official production
- Production branch: `main`
- Production website: https://world-simulator-osm-vzcapps.vercel.app
- Release line: Official 2.3.0
- Mobile-first responsive layout; designed to remain usable on Android browsers.

## Official 2.3.0 overhaul
- Corrected campaign advance pacing so frontline progress is not applied twice in one simulation tick.
- Reworked economic state validation and migration. Population in the economy now follows the simulation engine's national population as the single source of truth.
- Added safe normalization for legacy or partial economy saves, resource inventories, treasury, tax rates, and productivity.
- Added import limits and structural validation for world-save files; old version 1 saves remain importable and are upgraded to the current save format.
- Improved save-file URL cleanup and delayed local persistence slightly to avoid writing the entire world to localStorage on every render tick.
- Updated official version branding and initialization event text.

## Existing simulation systems
- Natural Earth country geometry and land-border adjacency.
- Autonomous national AI profiles and evolutionary strategy candidates.
- Army, air force, navy, and logistics formations.
- Recruitment, upgrades, readiness, supply, campaign stages, territorial control, and ceasefires.
- Bilateral non-aggression, alliance, and trade treaties.
- GDP estimates, treasury, tax policy, employment estimates, resource production and consumption, and bilateral resource trade.
- Local world-save import/export and Firebase account/cloud synchronization where Firebase providers and Firestore rules are configured.

## Development and build
```bash
npm install
npm run dev
npm run build
```

## Data, simulation, and service limitations
- Military values, population capacities, GDP, and combat outcomes are game abstractions, not authoritative real-world data.
- Country boundaries use generalized Natural Earth geometry and are not suitable for tactical precision.
- Autonomous AI is rule-based simulation with evolutionary scoring; it is not a connected LLM agent.
- Cloud synchronization requires valid Firebase project configuration, enabled authentication providers, and deployed Firestore rules. Local saves remain available without cloud services.
- The app simulates while the page is open; it does not run a persistent background world when the browser is closed.
- Map tiles are provided by Esri World Topographic Map. Respect the provider's usage terms and availability.

## License
Application source: MIT.
