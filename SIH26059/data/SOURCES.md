# Actual data included in PolarRoute

The default snapshot is **17 September 2026, 12:00 UTC**, in the East Antarctic sector 68–84°E, 63–70°S. It is dated historical analysis, not a live navigation product.

## NOAA OISST v2.1

[Product documentation](https://www.ncei.noaa.gov/products/optimum-interpolation-sst) · [exact NetCDF source](https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr/202609/oisst-avhrr-v02r01.20260917.nc)

Real observation-based sea-surface temperature analysis and sea-ice concentration are extracted from the daily NOAA file. NOAA describes the ice field as a seven-day median used to construct marginal-ice-zone proxy temperatures. This is not instantaneous satellite imagery. Native resolution is 0.25°; nearest-neighbor alignment onto 30×44 planning nodes creates no new observed detail.

NetCDF packed ice values are 0–100, with scale factor 0.01. After decoding, the concentration is a fraction 0–1; it is not divided by 100 again. The source uses a '%' units label despite this packed representation. Fill values remain unavailable, represented separately by a `missing` mask, and are excluded from routes and ocean averages. Numeric placeholders under missing/land masks are not measurements and must not be interpreted as such.

The original download SHA-256 is stored in the snapshot's `sources` field. NOAA source files may be revised. The app caches successful date loads locally and includes this default processed snapshot for offline use.

## ERA5 wind via Open-Meteo

[API documentation and data attribution](https://open-meteo.com/en/docs/historical-weather-api)

Twenty-five samples from a 5×5 regular grid are retrieved at the NOAA analysis hour, using ERA5 explicitly, nearest grid-cell selection and m/s units. Meteorological direction is converted to eastward/northward components, then bilinearly aligned to the planning grid. These are historical reanalysis estimates, not local weather-station measurements or future forecasts. The full request URL is preserved in the snapshot. Open-Meteo data requires attribution; use of the free service is subject to its non-commercial service terms. Review the provider terms before commercial deployment.

## Natural Earth

[Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/) · [download source](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson)

Public-domain 1:50m land polygons south of 60°S are included. The displayed map draws this actual geometry in longitude/latitude coordinates. Land masks are sampled from these polygons. This generalized coastline is unsuitable for hydrographic clearance or nearshore navigation and does not resolve all ice shelves or coast changes.

## What is not observed

No current, wave, depth or iceberg inventory data is included. Missing layers are marked unassessed. No invented iceberg positions are added. Drift is unavailable without required forcing. Real-data mode refuses the synthetic-trained ridge model. Persistence holds the analysis fixed into future frames; it is a baseline projection, not a validated forecast. The previous concentration input repeats current only to satisfy the existing input contract and is marked `previous_interval_hours: 0`.

Vessel endpoints are suggested grid cells for investigation, not a recorded voyage. Routes, transit times and fuel indices remain computed research outputs, with omitted forcing and vessel physics clearly stated. A real dataset does not make these predictions operationally safe.

The bundled winter analysis can legitimately return no accepted route at the default ice limit. It is not modified to manufacture a passage.
