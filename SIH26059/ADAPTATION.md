# Adaptation from SIH26143 to SIH26059

Inspected source: https://github.com/apranav1711-byte/OilSplitting at commit `ea9e0663fb29622fe458600d59c8d5abf8520f24`. The separate https://github.com/apranav1711-byte/SIH26143 repository was empty when downloaded.

The original repository combines a React interface, a Streamlit demonstration, SAR/wind preprocessing and UNet++/SCSE oil-spill segmentation code. Its simulation and backtracking pages include predefined scenarios. Those scenario records and oil-spill model weights cannot serve as Antarctic training data or iceberg physics.

This adaptation preserves the original repository and adds a self-contained `SIH26059/` application. It carries over the workflow idea—environmental inputs, spatial reasoning, simulation, comparison and evidence export—but implements the Antarctic calculations separately. No claim is made that the original oil-spill neural-network weights have been transferred or validated for sea ice.

| Original capability | New role | Treatment |
|---|---|---|
| SAR/wind fusion concept | Satellite and environmental evidence fusion | Retained as the research direction |
| Oil segmentation / UNet++ | Sea-ice forecasting and optional future iceberg segmentation | New baseline; original weights not used |
| Particle movement / backtracking UI | Forward iceberg forecast | New reduced drag model and sensitivity ensemble |
| Vessel attribution | Vessel route assessment | Replaced with constrained path search |
| Scenario visualization | Ice concentration and track timeline | New offline chart with explicit synthetic provenance |
| Claimed oil-spill benchmark scores | Antarctic evaluation | Excluded; fresh synthetic results generated from code |

Why a sibling application: the source's neural-network pipeline requires a different label definition, Antarctic data and retraining. A lightweight, functioning baseline makes those missing research steps visible and gives the team a complete demo without implying that renaming oil-spill outputs solves SIH26059.

All Antarctic prototype code is contained in `SIH26059/`. The folder can be copied to another checkout without changing the original application.
