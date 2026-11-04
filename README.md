# World Simulator OSM — Official Main Release

Spectator-first global strategy simulation. Every country is controlled by deterministic autonomous rules; the visitor observes, pauses, and adjusts simulation speed.

## Official release entry
- Added a launch screen: the simulation does not start ticking until the visitor presses **Enter Beta**.
- Added **Create New World** to reset the local simulation and **Enter Beta** to continue the browser's saved world.
- Preview build is deployed on a unique Vercel Preview URL, not the production alias.

## Beta 0.1 simulation features
- Global OpenStreetMap basemap and Natural Earth country outlines.
- Country database with capital coordinates, population estimates, and land-border adjacency.
- Capital headquarters and recruitable army, air force, navy, and logistics formations.
- Unit readiness, supply consumption, recovery, recruitment costs, national credits, and five upgrade tracks.
- Autonomous conflict selection restricted to adjacent independent countries; non-aggression and alliance treaties prevent a declaration between signatories.
- Multi-stage campaign: mobilization → capital-to-border movement → border-to-capital advance → abstract battle → country-level control transfer.
- Map route and moving unit markers; country polygons recolor when territorial controller changes.
- Bilateral non-aggression, alliance, and trade treaties with relationship scores.
- Browser localStorage auto-save, pause/resume, and 1×/2×/5×/10× simulation speed.
- Responsive mobile interface.

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Access and privacy note
- The launch screen is an intentional entry step, not authentication. Anyone who obtains the Preview URL can open it. Do not distribute the URL publicly if the test should remain small; a true invite-only gate requires server-side authentication or Vercel Deployment Protection.

## Important Beta 0.1 limitations
- The campaign has abstract phases, not real administrative provinces. A successful campaign changes the controller of the whole country polygon; there is no province-by-province occupation or detailed front-line geometry yet.
- The capital-to-border route is a simplified straight-line route to a shared-border point, not a road/pathfinding network.
- AI is deterministic rule-based simulation, not a connected LLM agent or a server-side autonomous worker.
- State is saved only in the current browser's localStorage. Clearing browser data or changing devices does not sync saves.
- The simulation runs while the page is open; no persistent background worker or shared multiplayer world is configured.
- Military values and starting force inventories are game abstractions, not current real-world military intelligence.
- Country-level borders use Natural Earth / world-atlas generalization and are not suitable for tactical precision.

## Data and map attribution
- Country names, capitals and population fields: `world-countries` package.
- Country geometry and adjacency: `world-atlas` / Natural Earth.
- Map tiles: © OpenStreetMap contributors. Follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

## License
Application source: MIT.


## Official release additions
- Civilian economy panel with GDP estimates, treasury, tax policy, employment estimate, and resource stocks.
- Versioned `.worldsave` import/export for local backups.
- Local browser economy persistence.
- Firebase sign-in, private cloud world snapshots, and queued AI training-event synchronization. Firebase Authentication providers and Firestore rules must be configured in the Firebase console before cloud features are available.
- Official deployment is built from the `main` branch.
