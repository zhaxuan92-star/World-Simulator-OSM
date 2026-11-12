# World Simulator OSM — Official Release

World Simulator is a browser-based global strategy sandbox. It simulates sovereign countries, borders, autonomous governments, military campaigns, diplomacy, research, and a civilian economy.

## Official production
- Production branch: `main`
- Production website: https://world-simulator-osm-vzcapps.vercel.app
- Release line: Official 3.1.0
- Mobile-first responsive layout; designed to remain usable on Android browsers.

## Vzc© brand and copyright information
- Parent brand information: https://vzc-copyright-center.vercel.app/
- Machine-readable brand profile: https://vzc-copyright-center.vercel.app/brand.json
- AI/crawler reading guide: https://vzc-copyright-center.vercel.app/llms.txt
- Copyright and licence scope: https://vzc-copyright-center.vercel.app/copyright/
- Publisher notice in this repository: [WORLD-SIMULATOR-COPYRIGHT-Vzc-Corporation.md](legal/WORLD-SIMULATOR-COPYRIGHT-Vzc-Corporation.md)
- Brand relationship: World Simulator OSM is presented as a joint Vzcapps × Vzcgames game/network product.

## Vzcmusico music library
- In-game background music is sourced from [Kho-r-c-](https://github.com/zhaxuan92-star/Kho-r-c-).
- The game loads [tracks.json](https://raw.githubusercontent.com/zhaxuan92-star/Kho-r-c-/main/tracks.json), with MP3 discovery as a fallback, and the player provides source and rights-notice links.
- Music rights notice: [VZCMUSICO-COPYRIGHT.md](https://github.com/zhaxuan92-star/Kho-r-c-/blob/main/VZCMUSICO-COPYRIGHT.md).
- A manifest entry marked `approved: true` means it is included in the playback catalogue only; it does not establish copyright clearance. Individual tracks remain subject to their rights holders' terms.

## Official 2.3.0 overhaul
- Corrected campaign advance pacing so frontline progress is not applied twice in one simulation tick.
- Reworked economic state validation and migration. Population in the economy now follows the simulation engine's national population as the single source of truth.
- Added safe normalization for legacy or partial economy saves, resource inventories, treasury, tax rates, and productivity.
- Added import limits and structural validation for world-save files; old version 1 saves remain importable and are upgraded to the current save format.
- Improved save-file URL cleanup and delayed local persistence slightly to avoid writing the entire world to localStorage on every render tick.
- Updated official version branding and initialization event text.

## VZC shared platform database (3.1.0)
- World Simulator and Web-TT use the same Firebase project: `db-fg-9608f`.
- World Simulator keeps its existing Google/anonymous authentication, cloud world snapshots, economy snapshots, and AI training event sync.
- Web-TT uses the `news_branches` and `news_articles` Firestore collections. Public reads are enabled; writes and deletes are restricted to the authenticated document owner/author.
- Firestore rules are maintained in `firestore.rules`. Publish the updated rules to the Firebase project before expecting Web-TT cloud sync to work. The game collections and their existing owner restrictions are retained.
- Web-TT retains localStorage as an offline fallback and migrates local branches/articles when the shared news collections are empty.

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

## Licence
Application source: MIT. See the repository [LICENSE](LICENSE) file. The MIT licence governs the source code it covers and is not narrowed by the publisher's separate notice. Third-party assets and services remain subject to their own licences and terms.
