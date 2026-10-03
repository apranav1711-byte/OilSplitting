# Research guide for SIH26059

Reviewed 3 October 2026. This is a reading guide, not an original research paper or a claim of replicated results. These models are not deployed in PolarRoute.

## Start here: Antarctic forecasting

**Subseasonal Prediction of Regional Antarctic Sea Ice by a Deep Learning Model** (2023), Geophysical Research Letters. [Publisher and DOI](https://doi.org/10.1029/2023GL104347).

SIPNet forecasts regional Antarctic concentration at weekly, subseasonal lead times from historical concentration. It is a closer geographic match than Arctic IceNet. Use it to design Antarctic input sequences and regional evaluation. It does not validate our six-hour synthetic baseline or provide a ready vessel-routing solution.

**Extended seasonal prediction of Antarctic sea ice concentration using ANTSIC-UNet** (Yang et al., 2025), The Cryosphere 19, 6381–6402. [Open paper](https://tc.copernicus.org/articles/19/6381/2025/) · [DOI](https://doi.org/10.5194/tc-19-6381-2025).

The multivariable U-Net targets forecasts up to six months. It evaluates concentration and integrated ice-edge errors against statistical and dynamical baselines. Its useful lessons are multivariable forcing, independent benchmark comparisons and extreme-year evaluation. Seasonal model skill cannot be substituted for short-range voyage validation.

## Iceberg physics

**An Analytical Model of Iceberg Drift** (Wagner, Dell and Eisenman, 2017), Journal of Physical Oceanography 47, 1605–1616. [Publisher and DOI](https://doi.org/10.1175/JPO-D-16-0262.1).

The work relates drift to iceberg size, wind and ocean velocity. A small-iceberg wind rule does not apply universally to large Antarctic tabular icebergs. This supports treating geometry and model applicability explicitly. PolarRoute's sail/draft drag baseline omits important forces and is not a reproduction of this analytical model. Next steps should include observed track comparisons and a validated dynamical model such as [OpenBerg](https://opendrift.github.io/autoapi/opendrift/models/openberg/index.html).

## Useful reference with a geographic limit

**Seasonal Arctic sea ice forecasting with probabilistic deep learning** (Andersson et al., 2021), Nature Communications 12, 5124. [Open paper](https://www.nature.com/articles/s41467-021-25257-4).

IceNet predicts monthly averaged Arctic concentration up to six months ahead and studies probabilistic calibration. Use it as a reference for uncertainty evaluation. It is Arctic research; neither the results nor weights establish Antarctic performance. Our sensitivity radii are not calibrated probabilities.

## Proposed next experiment

1. Build a reproducible Antarctic dataset with concentration, observation masks and aligned environmental fields. Preserve missingness, units, licensing and timestamps.
2. Split by time and retain extreme years for held-out analysis. Avoid randomly splitting neighboring pixels across train and test.
3. Start with persistence and climatology; compare a learned Antarctic model with RMSE/MAE and ice-edge metrics. Evaluate each forecast lead separately.
4. Compare iceberg trajectories against observations using displacement error at each lead. Evaluate whether uncertainty envelopes actually cover observations at the claimed rate.
5. Assess routing separately: verified coastlines/depth, vessel constraints, time-dependent hazards and operator review. Concentration forecast skill alone cannot certify a route.

These are proposed experiments, not completed validations. The prototype now supports imported forecast frames, environmental grids, explicit exclusion zones, transparent synthetic evaluation and exportable route decisions for future integration.
