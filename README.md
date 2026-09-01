# 🌊 Wind-Field-Integrated Deep Learning for Marine Oil Spill Detection

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-ee4c2c.svg)](https://pytorch.org/)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.30+-ff4b4b.svg)](https://streamlit.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An end-to-end deep learning prototype implementing the research paper:
> **"Wind-Field-Integrated Deep Learning for Marine Oil Spill Detection: Suppressing False Positives in SAR Imagery"**  
> *IEEE Journal of Selected Topics in Applied Earth Observations and Remote Sensing*, 2026.  
> Authors: Lusheng Chen, Chengyu Luo, Hongshan Duan, Shaojie Sun, Zhimin Bai, Yuchen Liang.

---

## 📌 The Problem: SAR "Look-Alikes"

Synthetic Aperture Radar (SAR) is the gold standard for global marine oil spill monitoring. Oil dampens ocean surface roughness and capillary waves, showing up as low-backscatter **dark patches**.

However, single-polarization SAR (like Sentinel-1 VV) suffers from pervasive **false positive alarms**:
1. **Low-Wind-Speed Areas (LWSAs)**: When wind drops below $\sim 2\text{--}3\text{ m/s}$, the ocean surface becomes mirror-like and smooth, producing broad dark patches indistinguishable from oil slicks in raw backscatter.
2. **Leeward Sides of Islands (LSIs)**: Islands physically shelter sea surfaces and cause wake turbulence downstream, creating persistent dark look-alikes along the wind path.

Conventional single-channel SAR models misclassify these features as oil spills, producing false positive rates (FPR) exceeding **80%**.

---

## 💡 The Solution: SAR-UV Framework

This repository couples **Sentinel-1 VV-polarized SAR imagery** with collocated **10-meter zonal ($U_{10}$) and meridional ($V_{10}$) wind vector components** (e.g., from ERA5 reanalysis, GFS forecast, or ASCAT scatterometer).

```
                          ┌────────────────────────────┐
                          │   Input Data Stream        │
                          │ - Sentinel-1 VV SAR (dB)   │
                          │ - ERA5 U10, V10 Wind (m/s) │
                          └─────────────┬──────────────┘
                                        │
                         [ Preprocessing & Normalization ]
                         - SAR dB: [-50, 10] -> [0, 1]
                         - Wind:   [-10, 10] -> [0, 1]
                                        │
                                        ▼
                           ┌─────────────────────────┐
                           │      UNet++ + SCSE      │
                           │  Nested Skip + Dual Attn│
                           └────────────┬────────────┘
                                        │
                                        ▼
                         [ Comparative Evaluation Engine ]
                         - False Positive Rate (FPR) in LWSAs
                         - False Positive Rate (FPR) in LSIs
                         - Precision, Recall, F1-Score
                         - Live Wind Perturbation Stress Test
                                        │
                                        ▼
                         [ Interactive Visual Dashboard ]
                         (Streamlit / Modern Web Interface)
```

### Key Technical Highlights:
- **UNet++ Backbone**: Dense, nested skip connections preserve thin, elongated slick filaments and platform leak branches.
- **SCSE Attention**: Concurrent Spatial Squeeze & Channel Excitation ($sSE$) and Channel Squeeze & Spatial Excitation ($cSE$) recalibrates informative channels while suppressing uniform clutter and speckle noise.
- **Continuous $(U_{10}, V_{10})$ Wind Decomposition**: Unlike scalar wind direction (which suffers from angular seams at $0^\circ \leftrightarrow 360^\circ$) or scalar speed, orthogonal vector components allow convolutional kernels to naturally learn directional wake physics and spatial gradients.
- **Binary Cross-Entropy (BCE) Optimization**: Penalizes false alarms across vast calm water extents, forcing the model to stay conservative unless backscatter and wind context agree.

---

## 📊 Benchmark Results

Evaluated across high-fidelity benchmark maritime environments replicating the paper's key cases:

| Scenario | Look-Alike Condition | Baseline (SAR-VV) | Proposed (SAR-UV) | False Positive Suppression |
| :--- | :--- | :---: | :---: | :---: |
| **Caspian Sea** | Offshore platform leak + extensive LWSA | Prec: 10.7% \| F1: 19.3% | **Prec: 44.1% \| F1: 61.2%** | **$FPR_{LWSA}$: 82.9% $\rightarrow$ 0.0%** |
| **Ionian Sea** | Island wake (LSI) with vessel discharge | Prec: 23.7% \| F1: 38.3% | **Prec: 38.8% \| F1: 55.9%** | **$FPR_{LSI}$: 43.5% $\rightarrow$ 4.6%** |
| **Red Sea** | Dual elongated collision slicks | Prec: 48.1% \| F1: 64.9% | **Prec: 58.2% \| F1: 73.5%** | **$FPR_{LWSA}$: 58.4% $\rightarrow$ 0.4%** |

---

## 🚀 Quickstart

### 1. Installation
Clone the repository and install requirements:
```bash
git clone https://github.com/apranav1711-byte/OilSplitting.git
cd OilSplitting
pip install -r requirements.txt
```

### 2. Launch the Interactive Web Dashboard
Run the Streamlit application:
```bash
streamlit run app.py
```
Open `http://localhost:8501` to:
- Inspect Sentinel-1 SAR imagery with collocated wind vector quiver overlays.
- Compare side-by-side probability heatmaps and binary masks (`SAR-VV` vs. `SAR-UV`).
- Track look-alike suppression metrics in real-time.
- Conduct live **wind perturbation stress tests** (mirrored winds, zero winds, noise injection).

### 3. Run Benchmark Suite from CLI
```bash
python -m src.engine.eval_benchmark
```

### 4. Re-train Models
```bash
python -m src.engine.train
```

### 5. Run Modern React + Vite Frontend (chargeBackShield Sketch Design)
```bash
# Install frontend dependencies
npm install

# Start Vite dev server (runs on http://localhost:3000)
npm run dev

# Or build for production
npm run build
```

### 6. Run Python Unit Tests
```bash
python -m unittest discover tests
```

---

## 📁 Repository Structure

```
OilSplitting/
├── client/                     # React 19 + Vite Frontend (chargeBackShield Sketch Design)
│   ├── index.html              # Caveat, DM Mono, and Inter typography
│   ├── src/
│   │   ├── index.css           # Tactile sketch-card, hand-note, and cream paper styling
│   │   ├── App.tsx             # Wouter routing across 6 surveillance views
│   │   ├── main.tsx            # React application root
│   │   ├── components/         # DashboardLayout (sidebar), ScreenHeader, UI suite
│   │   ├── pages/              # Overview, DetectionStudio, LookAlikeFeed, WindLab, Transparency, AuditLog
│   │   └── lib/                # Benchmark data, incident records, and confusion matrix
├── package.json                # Frontend npm configuration (React, Tailwind v4, Recharts, Lucide)
├── vite.config.ts              # Vite configuration with Tailwind v4 & aliases
├── tsconfig.json               # TypeScript compiler configuration
├── app.py                      # Interactive Streamlit Web Application
├── requirements.txt            # Python dependencies
├── .gitignore                  # Git ignore rules
├── README.md                   # Project documentation
├── checkpoints/                # Pretrained model weights (.pt)
│   ├── sar_vv_model.pt         # Baseline 1-channel UNet++ model
│   └── sar_uv_model.pt         # Proposed 3-channel UNet++ SCSE model
├── src/
│   ├── data/
│   │   ├── preprocessor.py     # Radiometric & wind vector normalization
│   │   └── benchmark_generator.py # Maritime SAR benchmark scenarios (Caspian, Ionian, Red Sea)
│   ├── engine/
│   │   ├── evaluator.py        # Dual model comparative inference & perturbation engine
│   │   ├── eval_benchmark.py   # CLI benchmark test suite runner
│   │   ├── losses_metrics.py   # BCE, Dice, Focal loss & stratified metrics (FPR_LWSA, FPR_LSI)
│   │   └── train.py            # Training pipeline for SAR-VV and SAR-UV
│   └── models/
│       ├── scse.py             # Spatial & Channel Squeeze-and-Excitation (SCSE) module
│       └── unet_plus_plus.py   # UNet++ with nested dense skip connections
└── tests/
    ├── test_model.py           # Unit tests for network architecture & forward pass
    └── test_pipeline.py        # Unit tests for preprocessing, generator, and metrics
```

---

## 📖 Citation

```bibtex
@article{chen2026wind,
  title={Wind-Field-Integrated Deep Learning for Marine Oil Spill Detection: Suppressing False Positives in SAR Imagery},
  author={Chen, Lusheng and Luo, Chengyu and Duan, Hongshan and Sun, Shaojie and Bai, Zhimin and Liang, Yuchen},
  journal={IEEE Journal of Selected Topics in Applied Earth Observations and Remote Sensing},
  volume={19},
  pages={22838--22862},
  year={2026},
  doi={10.1109/JSTARS.2026.3708894}
}
```

---

## 📄 License
This project is licensed under the MIT License.
