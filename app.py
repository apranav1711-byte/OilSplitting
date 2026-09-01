"""
Streamlit Web Application: Wind-Field-Integrated SAR Marine Oil Spill Detection
Prototype implementing Chen et al., IEEE JSTARS 2026.
Features:
- Dual model comparative inference: SAR-VV (baseline) vs. SAR-UV (proposed UNet++ SCSE)
- Wind vector field quiver visualization
- Live look-alike suppression tracking (FPR_LWSA, FPR_LSI)
- Real-time wind perturbation stress testing (mirroring, noise, direction/speed overrides)
"""

import os
import streamlit as st
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import torch

from src.data.benchmark_generator import MaritimeBenchmarkGenerator
from src.data.preprocessor import SARWindPreprocessor
from src.engine.evaluator import OilSpillEvaluator
from src.engine.losses_metrics import SegmentationMetrics


st.set_page_config(
    page_title="SAR Marine Oil Spill Detection | SAR-UV with UNet++ SCSE",
    page_icon="🌊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for modern, premium appearance
st.markdown("""
<style>
    .main {
        background-color: #0b0f19;
        color: #f1f5f9;
    }
    .metric-card {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .metric-title {
        font-size: 0.85rem;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
    }
    .metric-value {
        font-size: 1.6rem;
        font-weight: 700;
        color: #38bdf8;
    }
    .badge-success {
        background-color: rgba(16, 185, 129, 0.2);
        color: #34d399;
        border: 1px solid #059669;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    .badge-danger {
        background-color: rgba(239, 68, 68, 0.2);
        color: #f87171;
        border: 1px solid #dc2626;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px;
        padding: 8px 16px;
        background-color: #1e293b;
        color: #cbd5e1;
    }
    .stTabs [aria-selected="true"] {
        background-color: #0284c7 !important;
        color: #ffffff !important;
    }
</style>
""", unsafe_allow_html=True)


@st.cache_resource
def load_evaluator():
    """Initializes the dual model evaluator."""
    vv_ckpt = "checkpoints/sar_vv_model.pt" if os.path.exists("checkpoints/sar_vv_model.pt") else None
    uv_ckpt = "checkpoints/sar_uv_model.pt" if os.path.exists("checkpoints/sar_uv_model.pt") else None
    return OilSpillEvaluator(
        checkpoint_sar_vv=vv_ckpt,
        checkpoint_sar_uv=uv_ckpt,
        device="cpu"
    )


def create_sar_wind_figure(sar_db, u10, v10, title="SAR Backscatter & Collocated Wind Field"):
    """Renders Sentinel-1 SAR backscatter with overlaid ERA5 wind vector quiver."""
    H, W = sar_db.shape
    speed, direction = SARWindPreprocessor.compute_speed_and_direction(u10, v10)

    fig, ax = plt.subplots(figsize=(6, 6), facecolor="#0f172a")
    ax.set_facecolor("#0f172a")

    im = ax.imshow(sar_db, cmap="gray", vmin=-35, vmax=0, extent=[0, W, H, 0])
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("VV Backscatter [dB]", color="#cbd5e1", fontsize=10)
    cbar.ax.yaxis.set_tick_params(color="#cbd5e1")
    plt.setp(plt.getp(cbar.ax.axes, 'yticklabels'), color='#cbd5e1')

    # Subsample grid for quiver arrows
    step = max(16, W // 16)
    y_grid, x_grid = np.mgrid[step//2:H:step, step//2:W:step]
    u_sub = u10[step//2:H:step, step//2:W:step]
    v_sub = v10[step//2:H:step, step//2:W:step]
    spd_sub = speed[step//2:H:step, step//2:W:step]

    # Overlay wind arrows (green vectors)
    q = ax.quiver(
        x_grid, y_grid, u_sub, -v_sub,  # negative v for downward image coordinates
        color="#10b981", scale=80, width=0.005, headwidth=4, alpha=0.9
    )
    ax.set_title(title, color="#f8fafc", fontsize=11, fontweight="bold", pad=10)
    ax.tick_params(colors="#64748b")
    for spine in ax.spines.values():
        spine.set_color("#334155")

    fig.tight_layout()
    return fig


def create_heatmap_mask_figure(prob_map, binary_mask, title, is_uv=False):
    """Renders probability heatmap and binary classification mask side-by-side."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8, 4), facecolor="#0f172a")
    ax1.set_facecolor("#0f172a")
    ax2.set_facecolor("#0f172a")

    cmap_heat = "magma"
    im1 = ax1.imshow(prob_map, cmap=cmap_heat, vmin=0.0, vmax=1.0)
    ax1.set_title("Spill Probability Map", color="#cbd5e1", fontsize=10)
    cbar1 = fig.colorbar(im1, ax=ax1, fraction=0.046, pad=0.04)
    cbar1.ax.yaxis.set_tick_params(color="#cbd5e1")
    plt.setp(plt.getp(cbar1.ax.axes, 'yticklabels'), color='#cbd5e1')

    # Mask: 0=water, 1=oil
    cmap_mask = mcolors.ListedColormap(["#0f172a", "#ef4444" if not is_uv else "#38bdf8"])
    ax2.imshow(binary_mask, cmap=cmap_mask, vmin=0, vmax=1)
    ax2.set_title("Binary Detection Mask", color="#cbd5e1", fontsize=10)

    for ax in [ax1, ax2]:
        ax.tick_params(colors="#64748b")
        for spine in ax.spines.values():
            spine.set_color("#334155")

    fig.suptitle(title, color="#f8fafc", fontsize=12, fontweight="bold", y=0.98)
    fig.tight_layout()
    return fig


def create_ground_truth_figure(gt_oil, lwsa_mask, lsi_mask):
    """Renders Ground Truth with annotated look-alike regions."""
    H, W = gt_oil.shape
    vis = np.zeros((H, W, 3), dtype=np.float32)
    # Dark sea background: deep navy
    vis[:, :] = [0.06, 0.09, 0.16]

    # LWSA look-alike calm water in Amber/Gold
    if lwsa_mask is not None and np.any(lwsa_mask > 0):
        vis[lwsa_mask > 0] = [0.85, 0.65, 0.13]

    # LSI island wake look-alike in Cyan
    if lsi_mask is not None and np.any(lsi_mask > 0):
        vis[lsi_mask > 0] = [0.06, 0.72, 0.82]

    # Genuine Oil Slick in Vibrant Red (drawn on top)
    vis[gt_oil > 0] = [0.93, 0.27, 0.27]

    fig, ax = plt.subplots(figsize=(6, 6), facecolor="#0f172a")
    ax.imshow(vis, extent=[0, W, H, 0])
    ax.set_title("Ground Truth & Annotated Look-Alike Zones", color="#f8fafc", fontsize=11, fontweight="bold", pad=10)

    # Custom legend
    patches = [
        plt.Line2D([0], [0], marker='s', color='w', label='Genuine Oil Slick', markerfacecolor='#ef4444', markersize=10),
        plt.Line2D([0], [0], marker='s', color='w', label='LWSA (Low-Wind Calm)', markerfacecolor='#d97706', markersize=10),
        plt.Line2D([0], [0], marker='s', color='w', label='LSI (Island Wake)', markerfacecolor='#06b6d4', markersize=10),
        plt.Line2D([0], [0], marker='s', color='w', label='Ambient Sea', markerfacecolor='#0f172a', markersize=10)
    ]
    ax.legend(handles=patches, loc="upper right", facecolor="#1e293b", edgecolor="#334155", labelcolor="#f8fafc", fontsize=9)
    ax.tick_params(colors="#64748b")
    for spine in ax.spines.values():
        spine.set_color("#334155")

    fig.tight_layout()
    return fig


# -----------------------------------------------------------------------------
# Main Application
# -----------------------------------------------------------------------------

def main():
    st.title("🌊 Wind-Field-Integrated Marine Oil Spill Detection")
    st.caption("Implementation of **Chen et al.**, *IEEE JSTARS (2026)* — UNet++ SCSE with ERA5 $U_{10}/V_{10}$ Wind Vectors")

    evaluator = load_evaluator()

    # Sidebar Controls
    with st.sidebar:
        st.header("⚙️ Configuration")
        scenario_key = st.selectbox(
            "Select Maritime Scenario",
            options=["caspian_sea", "ionian_sea", "red_sea"],
            format_func=lambda k: {
                "caspian_sea": "1. Caspian Sea (Platform Leak + LWSA)",
                "ionian_sea": "2. Ionian Sea (Island Wake / LSI)",
                "red_sea": "3. Red Sea (Collision Slicks)"
            }[k]
        )

        st.subheader("Model Inference Settings")
        prob_threshold = st.slider("Classification Threshold", min_value=0.1, max_value=0.9, value=0.5, step=0.05)

        st.subheader("🧪 Wind Perturbation Stress Test")
        st.markdown("*Section IV-B2: Evaluate model sensitivity to wind consistency.*")
        perturbation_mode = st.radio(
            "Wind Input State",
            options=["none", "mirror", "zero", "cross_noise", "manual_override"],
            format_func=lambda x: {
                "none": "Normal (Matched Wind Field)",
                "mirror": "Mirrored Wind (Reversed Vectors)",
                "zero": "Zero Wind (No Wind Context)",
                "cross_noise": "Uncorrelated Wind Noise",
                "manual_override": "Manual Wind Speed/Direction Tweak"
            }[x]
        )

        override_speed = None
        override_dir = None
        if perturbation_mode == "manual_override":
            override_speed = st.slider("Synthetic Wind Speed [m/s]", 0.0, 15.0, 3.5, 0.5)
            override_dir = st.slider("Synthetic Wind Direction [deg]", 0, 360, 45, 15)

    # Generate or retrieve scenario data
    benchmark_scenes = MaritimeBenchmarkGenerator.get_benchmark_scenes()
    scene = benchmark_scenes[scenario_key]

    sar_db = scene["sar_db"]
    u10 = scene["u10"].copy()
    v10 = scene["v10"].copy()
    gt_oil = scene["ground_truth_oil"]
    lwsa_mask = scene.get("lwsa_mask")
    lsi_mask = scene.get("lsi_mask")

    # Apply manual override if selected
    effective_perturbation = perturbation_mode
    if perturbation_mode == "manual_override":
        rad = np.radians(override_dir)
        u10 = np.full_like(u10, override_speed * np.cos(rad))
        v10 = np.full_like(v10, override_speed * np.sin(rad))
        effective_perturbation = "none"

    # Run evaluation
    scene_eval_data = {
        "sar_db": sar_db,
        "u10": u10,
        "v10": v10,
        "ground_truth_oil": gt_oil,
        "lwsa_mask": lwsa_mask,
        "lsi_mask": lsi_mask
    }
    results = evaluator.evaluate_scene(
        scene_eval_data,
        threshold=prob_threshold,
        wind_perturbation=effective_perturbation
    )

    preds = results["predictions"]
    m_vv = results["metrics_vv"]
    m_uv = results["metrics_uv"]
    delta = results["comparison"]

    # Scenario Banner
    col_meta1, col_meta2, col_meta3, col_meta4 = st.columns(4)
    with col_meta1:
        st.markdown(f"<div class='metric-card'><div class='metric-title'>Region</div><div class='metric-value'>{scene['region']}</div></div>", unsafe_allow_html=True)
    with col_meta2:
        st.markdown(f"<div class='metric-card'><div class='metric-title'>Mean Wind</div><div class='metric-value'>{scene['mean_wind_speed']:.1f} m/s</div></div>", unsafe_allow_html=True)
    with col_meta3:
        look_alike = "LWSA (Calm Water)" if np.any(lwsa_mask > 0) else ("LSI (Island Wake)" if np.any(lsi_mask > 0) else "None")
        st.markdown(f"<div class='metric-card'><div class='metric-title'>Look-Alike Risk</div><div class='metric-value' style='color:#f59e0b;'>{look_alike}</div></div>", unsafe_allow_html=True)
    with col_meta4:
        status_text = "NORMAL" if perturbation_mode == "none" else "PERTURBED"
        status_color = "#10b981" if perturbation_mode == "none" else "#ef4444"
        st.markdown(f"<div class='metric-card'><div class='metric-title'>Wind Condition</div><div class='metric-value' style='color:{status_color};'>{status_text}</div></div>", unsafe_allow_html=True)

    # Main Visual Comparison Tabs
    tab_inspect, tab_metrics, tab_theory = st.tabs(["🖼️ Detection & Look-Alike Suppression", "📊 Quantitative Scorecard", "📖 Paper Methodology & Insights"])

    with tab_inspect:
        col_view1, col_view2 = st.columns(2)
        with col_view1:
            fig_sar = create_sar_wind_figure(sar_db, preds["perturbed_u10"], preds["perturbed_v10"])
            st.pyplot(fig_sar)
        with col_view2:
            fig_gt = create_ground_truth_figure(gt_oil, lwsa_mask, lsi_mask)
            st.pyplot(fig_gt)

        st.markdown("---")
        st.subheader("Dual Model Comparison: Baseline (SAR-VV) vs. Proposed (SAR-UV with UNet++ SCSE)")

        col_model1, col_model2 = st.columns(2)
        with col_model1:
            st.markdown("#### ❌ Baseline: SAR-VV (Single Channel)")
            st.caption("Relies solely on radar backscatter. Mistakenly classifies low-wind calm water or island wakes as oil spills.")
            fig_vv = create_heatmap_mask_figure(preds["prob_vv"], preds["mask_vv"], "SAR-VV Detection", is_uv=False)
            st.pyplot(fig_vv)

        with col_model2:
            st.markdown("#### ✅ Proposed: SAR-UV (Wind-Integrated)")
            st.caption("Incorporates U10/V10 scene wind context. Correctly suppresses false alarms in calm waters while preserving true slicks.")
            fig_uv = create_heatmap_mask_figure(preds["prob_uv"], preds["mask_uv"], "SAR-UV Detection", is_uv=True)
            st.pyplot(fig_uv)

    with tab_metrics:
        st.subheader("Quantitative Evaluation & False Positive Suppression")

        col_score1, col_score2, col_score3, col_score4 = st.columns(4)
        with col_score1:
            st.metric(
                label="SAR-UV Precision",
                value=f"{m_uv['Precision']*100:.1f}%",
                delta=f"{delta['Delta_Precision_pct']:+.1f}% vs SAR-VV"
            )
        with col_score2:
            st.metric(
                label="SAR-UV F1-Score",
                value=f"{m_uv['F1']*100:.1f}%",
                delta=f"{delta['Delta_F1_pct']:+.1f}% vs SAR-VV"
            )
        with col_score3:
            if np.any(lwsa_mask > 0):
                fpr_lwsa_vv = m_vv["FPR_LWSA"] * 100.0
                fpr_lwsa_uv = m_uv["FPR_LWSA"] * 100.0
                diff_lwsa = fpr_lwsa_uv - fpr_lwsa_vv
                st.metric(
                    label="FPR in LWSA (Calm Waters)",
                    value=f"{fpr_lwsa_uv:.1f}%",
                    delta=f"{diff_lwsa:.1f}% (Suppressed)",
                    delta_color="inverse"
                )
            elif np.any(lsi_mask > 0):
                fpr_lsi_vv = m_vv["FPR_LSI"] * 100.0
                fpr_lsi_uv = m_uv["FPR_LSI"] * 100.0
                diff_lsi = fpr_lsi_uv - fpr_lsi_vv
                st.metric(
                    label="FPR in LSI (Island Wake)",
                    value=f"{fpr_lsi_uv:.1f}%",
                    delta=f"{diff_lsi:.1f}% (Suppressed)",
                    delta_color="inverse"
                )
            else:
                st.metric(label="Overall FPR", value=f"{m_uv['FPR']*100:.2f}%")
        with col_score4:
            st.metric(
                label="SAR-UV Recall",
                value=f"{m_uv['Recall']*100:.1f}%",
                delta=f"{delta['Delta_Recall_pct']:+.1f}% vs SAR-VV"
            )

        st.markdown("#### Detailed Metric Breakdown")
        table_data = {
            "Metric": ["Precision", "Recall", "F1-Score", "Overall FPR", "LWSA False Alarm Rate (FPR_LWSA)", "LSI False Alarm Rate (FPR_LSI)", "True Positives (Pixels)", "False Positives (Pixels)"],
            "Baseline: SAR-VV": [
                f"{m_vv['Precision']*100:.1f}%",
                f"{m_vv['Recall']*100:.1f}%",
                f"{m_vv['F1']*100:.1f}%",
                f"{m_vv['FPR']*100:.2f}%",
                f"{m_vv.get('FPR_LWSA', 0.0)*100:.1f}%",
                f"{m_vv.get('FPR_LSI', 0.0)*100:.1f}%",
                f"{m_vv['TP']:,}",
                f"{m_vv['FP']:,}"
            ],
            "Proposed: SAR-UV": [
                f"{m_uv['Precision']*100:.1f}%",
                f"{m_uv['Recall']*100:.1f}%",
                f"{m_uv['F1']*100:.1f}%",
                f"{m_uv['FPR']*100:.2f}%",
                f"{m_uv.get('FPR_LWSA', 0.0)*100:.1f}%",
                f"{m_uv.get('FPR_LSI', 0.0)*100:.1f}%",
                f"{m_uv['TP']:,}",
                f"{m_uv['FP']:,}"
            ],
            "Net Improvement": [
                f"{delta['Delta_Precision_pct']:+.1f}%",
                f"{delta['Delta_Recall_pct']:+.1f}%",
                f"{delta['Delta_F1_pct']:+.1f}%",
                f"{-delta['Delta_FPR_Reduction_pct']:+.2f}%",
                f"{(m_uv.get('FPR_LWSA', 0.0) - m_vv.get('FPR_LWSA', 0.0))*100:+.1f}%",
                f"{(m_uv.get('FPR_LSI', 0.0) - m_vv.get('FPR_LSI', 0.0))*100:+.1f}%",
                "-",
                f"{m_uv['FP'] - m_vv['FP']:+,} FP pixels"
            ]
        }
        st.table(table_data)

    with tab_theory:
        st.subheader("Physical Principles & Research Insights (Chen et al., 2026)")
        st.markdown(r"""
        ### Why Does Single-Band SAR Fail?
        1. **Capillary Wave Damping**: Both true oil spills and Low-Wind-Speed Areas (wind $< 2\text{--}3\text{ m/s}$) suppress high-frequency ocean surface roughness. To a radar emitting C-band pulses (like Sentinel-1 at 5.405 GHz), specular reflection sends the pulse away from the satellite, causing **both** phenomena to appear as identical black patches (low backscatter $\sigma^0$).
        2. **Island Topographic Sheltering (LSI)**: Mountains and hills on islands physically block wind, producing calm wake trails on the leeward side extending tens of kilometers downstream.

        ### Why Are U10 and V10 Vector Components Optimal?
        * **Avoiding Scalar Discontinuities**: Scalar wind direction has an angular seam at $0^\circ \leftrightarrow 360^\circ$ that neural network convolutions struggle to model.
        * **Orthogonal Decomposition**: $U_{10}$ (zonal, East-West) and $V_{10}$ (meridional, North-South) provide continuous numerical coordinates that allow spatial convolutions to seamlessly compute gradients and wake alignments.

        ### UNet++ with SCSE Attention
        * **Nested Skip Pathways**: Captures subtle, elongated slick tails that are often obliterated by deep encoder downsampling in standard UNet.
        * **SCSE Attention**: Recalibrates channel weights (prioritizing backscatter vs. wind depending on spatial context) and spatial regions (suppressing uniform background speckle).
        """)


if __name__ == "__main__":
    main()
