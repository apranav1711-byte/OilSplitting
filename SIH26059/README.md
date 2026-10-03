# PolarRoute — SIH26059

An offline prototype for **AI-Enabled Antarctic Sea-Ice, Iceberg Trajectory, and Navigation Decision Support System**, Ministry of Earth Sciences. The original OilSplitting application is preserved alongside this folder.

**All bundled environmental fields and coastlines are synthetic.** Calculations run locally; there are no connected satellite or live marine feeds. This is research demonstration software, not an operational navigation service.

## Run

Python 3.10+ and NumPy are the only runtime requirements:

```console
python -m pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:8059**. Keep the terminal running; Ctrl+C stops it. On the development computer, `Start-PolarRoute.ps1` also finds the bundled Python. The server binds to localhost and needs no account, API key, map subscription or GPU. Do not expose this development server publicly.

## Interactive workspace

The redesigned workspace adds switchable ice/wave/depth views, concentration contour bands, frame stepping and playback speed, chart PNG export, a quick guide, a route comparison table, and an in-session pinned-plan comparison. Draw up to eight circular exclusion zones on the chart; the planner blocks every intersected grid cell and recalculates. Undo removes the most recent zone. JSON saves include these zones; CSV environmental exports do not.

The Research library contains four verified papers with applicability notes and downloadable reading notes. See [the research guide](research/READING.md) for the reading order and proposed validation experiments. None of the published deep-learning systems is claimed as implemented here.

- **Voyage planner:** compare shortest passage, lower ice exposure and lower fuel proxy; view route metrics, an ice-exposure profile and overlapping exclusion causes.
- **Forecast chart:** pan, zoom, inspect cells, animate 6-hour frames and toggle currents, wind, routes, iceberg sensitivity members and exclusions. Use arrow keys and Enter on the chart for keyboard inspection or endpoint selection.
- **Editable observations:** change iceberg position, sail and draft; add/remove records; set vessel endpoints on the chart or through coordinate fields.
- **Constraints:** change horizon, speed, ice limit, iceberg clearance, maximum waves, vessel draft and wind sensitivity. Changed inputs are flagged until recalculated.
- **Forecast lab:** compare ridge forecasts against persistence on six held-out synthetic sequences. Imported forecast frames can bypass the synthetic model.
- **Data workspace:** import validated JSON or rectangular CSV grids; edit provenance; save up to six voyages in this browser; export scenario JSON, grid CSV, complete results, route GeoJSON, waypoint CSV or a voyage brief.

## Five-minute demo

1. Start with **Coastal passage**, 72 hours. Compare the three route cards and their exposure/distance trade-off. Different objectives may produce identical paths.
2. Play the timeline; inspect an iceberg, then enable Ensemble and Exclusions. The exclusion mask covers the entire selected forecast horizon.
3. Edit an iceberg's sail/draft and recalculate. Its drift responds to its geometry and the spatial wind/current fields.
4. Try **Crosswind passage**. Expand Weather & vessel limits and reduce the wave limit, then recalculate.
5. Choose **Closed corridor** to show an explicit no-route result. Return to Coastal passage; use 24 hours and 5 knots to show rejection for insufficient forecast coverage.
6. Save a voyage, change the scenario, then load the saved voyage from Data workspace. Export JSON for portable input/results storage.

## Models and boundaries

The concentration baseline is ridge autoregression trained at startup on 158,400 generated cell transitions. Regional boundaries repeat rather than wrap. Predictions use recent concentration, its change, neighboring gradients and temperature, in 6-hour steps up to 72 hours. Persistence holds concentration fixed; supplied frames use external forecasts directly.

Each iceberg has 40 reproducible sensitivity members. Geometry-dependent reduced equilibrium drag combines spatially sampled wind/current fields. Midpoint integration uses 30-minute steps. The model omits Coriolis, sea-ice mechanics, depth-dependent currents, melting and grounding. Extrapolation outside the forcing region and mean tracks crossing land generate warnings. This is not an implementation of OpenBerg.

Dijkstra searches an eight-neighbor grid without diagonal corner cutting. Its mask combines land, worst concentration across the horizon, swept iceberg envelope, wave limits and vessel draft plus a fixed 3 m clearance. Distances use great-circle segments. Transit time includes illustrative ice/wave penalties and current assistance. Routes longer than the forecast horizon are rejected. Routing uses a conservative static envelope, not time-dependent collision avoidance; exclusions do not establish real-world safety.

Ensemble spread is **sensitivity, not calibrated probability**. Fuel is a **relative proxy**, not litres, emissions or demonstrated savings. The synthetic benchmark shares its generating dynamics with training and establishes no Antarctic generalization. There is no satellite iceberg detector in this version.

## Input contract

Download Scenario JSON in Data workspace, or begin with `research/sample-scenario.json`.

| Field | Meaning |
|---|---|
| `previous`, `current` | 30 rows × 44 columns, ice fraction 0–1; previous is six hours earlier |
| `temperature` | Same grid, degrees Celsius |
| `land` | Same grid, boolean or 0/1; row zero is north |
| `bounds` | `[west,south,east,north]`; Southern Ocean 45–85°S, width 0.05–30°, height 0.05–15°, no dateline crossing |
| `wind_u`, `wind_v`, `current_u`, `current_v` | Scalars or same-size grids, m/s, positive east/north |
| `wave_height`, `depth` | Optional scalars/grids in metres; absent fields generate warnings and are not assessed |
| `start`, `goal` | Integer `[column,row]` within the grid |
| `icebergs` | Up to 20 unique records: `id`, fractional `x`,`y`, `sail` and `draft` in metres |
| `exclusion_zones` | Optional list of up to eight circles: fractional `x`,`y`, and `radius_km` 5–100; planner includes cell half-diagonal padding |
| `name`, `source`, `observed_at` | Required provenance and timezone-aware ISO timestamp |
| `forecast_frames` | Optional 5–13 concentration grids at six-hour intervals; first equals current; selected horizon needs enough frames |

CSV requires `longitude,latitude,current,previous,temperature,land,wind_u,wind_v,current_u,current_v`. Optional columns: `wave_height,depth,observed_at`. It must describe one complete rectangular coordinate grid, one timestamp and at most 20,000 rows. It is nearest-neighbor resampled to 30×44; mask/detail loss is possible. Review the result before use. Missing timestamps are marked historical, not assumed current. CSV does not include iceberg records; add those in the editor or import JSON. Imports must be under 2 MB. Invalid/nonfinite inputs are rejected, never converted to open water.

## Verify

```console
python -m unittest -v
python evaluate.py
```

Tests cover valid routes, blocked corridors, clearance monotonicity, reproducibility, forecast bounds, horizon rejection, wave/depth limits, CSV and geometry validation, regional boundaries, spatial sampling and no diagonal corner cutting. These are software checks, not field validation.

`evaluate.py` writes the held-out synthetic comparison and example inputs/results under `research/`. Runtime timing fields can vary. No paper or presentation is included.

## Files and API

`model.py` contains the scientific baseline and input validation; `app.py` serves the API; `index.html`, `style.css` and `ui.js` provide the offline interface. `ADAPTATION.md` explains the relationship to the original oil-spill project.

Endpoints: `GET /health`, `GET /api/scenario?kind=standard|crosswind|blocked`, `GET /api/evaluation`, `POST /api/run` with `{ "scenario": ..., "options": ... }`, and `POST /api/import-csv` with `{ "csv": "...", "name": "..." }`.

Options: `horizon` 24/48/72 hours, `speed` 5–18 knots, `ice_limit` 0.15–0.9, `buffer_km` 5–40, `wind_scale` 0–2, `max_wave` 1–10 m, `vessel_draft` 1–20 m, `forecast_method` ridge/persistence/supplied.

## Future real-data integration

The app links to [NSIDC sea-ice concentration](https://nsidc.org/data/g02202), [Copernicus ocean forecasts](https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description), [ERA5 historical forcing](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels), [USNIC iceberg products](https://usicecenter.gov/Products/AntarcIcebergs) and [OpenBerg](https://opendrift.github.io/autoapi/opendrift/models/openberg/index.html). They are integration references, not connected services. A real deployment requires properly licensed Antarctic observations, forecast forcing, verified masks/bathymetry, vessel calibration, independent skill assessment and expert review.
