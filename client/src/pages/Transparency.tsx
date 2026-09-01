import { ScreenHeader } from "@/components/ScreenHeader";
import { confusionMatrixData } from "@/lib/demoData";

export default function Transparency() {
  const uv = confusionMatrixData.sarUV;
  const vv = confusionMatrixData.sarVV;

  return (
    <div className="screen-shell">
      <ScreenHeader
        eyebrow="Model Performance &amp; Scientific Interpretability"
        title="Model Transparency &amp; Evaluation"
      />

      <section className="hand-note note-blue">
        <span>Scientific Integrity</span>
        <strong>Stratified Analysis across Wind Regimes &amp; Loss Functions</strong>
        <small>Full audit of pixel-level classifications, confusion matrix deltas, and training objectives</small>
      </section>

      {/* Mini Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <article className="sketch-card p-4">
          <p className="eyebrow">Overall Precision</p>
          <strong className="text-2xl font-bold text-sky-700 block mt-1">89.4%</strong>
          <small className="text-stone-500 block mt-1">+52.9% mean gain across 20 test scenes</small>
        </article>

        <article className="sketch-card p-4">
          <p className="eyebrow">Overall Recall</p>
          <strong className="text-2xl font-bold text-stone-800 block mt-1">83.4%</strong>
          <small className="text-stone-500 block mt-1">Preserves delicate slick filaments</small>
        </article>

        <article className="sketch-card p-4">
          <p className="eyebrow">Median FPR in LWSAs</p>
          <strong className="text-2xl font-bold text-emerald-700 block mt-1">0.9%</strong>
          <small className="text-emerald-800 font-semibold block mt-1">Reduced from 86.8% (SAR-VV)</small>
        </article>

        <article className="sketch-card p-4">
          <p className="eyebrow">Median FPR in LSIs</p>
          <strong className="text-2xl font-bold text-emerald-700 block mt-1">3.9%</strong>
          <small className="text-emerald-800 font-semibold block mt-1">Reduced from 79.6% (SAR-VV)</small>
        </article>
      </div>

      {/* Grid: Confusion Matrix + Wind Regimes */}
      <div className="transparency-grid">
        {/* Confusion Matrix Card (from chargeBackShield) */}
        <section className="sketch-card matrix-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Pixel-Level Confusion Matrix</p>
              <h2>SAR-UV Classification Delta</h2>
            </div>
            <span className="mono text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              -93.3% False Alarms
            </span>
          </div>

          <div className="confusion-matrix">
            <span></span>
            <strong>Pred Non-Oil</strong>
            <strong>Pred Oil Spill</strong>

            <strong>Actual Non-Oil</strong>
            <b className="true-negative">
              {uv.tn.toLocaleString()}
              <small>True Negative (Water)</small>
            </b>
            <b className="false-positive">
              {uv.fp.toLocaleString()}
              <small className="text-red-700 font-bold">FP (was {vv.fp})</small>
            </b>

            <strong>Actual Oil Slick</strong>
            <b className="false-negative">
              {uv.fn.toLocaleString()}
              <small>FN (Missed)</small>
            </b>
            <b className="true-positive">
              {uv.tp.toLocaleString()}
              <small>True Positive (Oil)</small>
            </b>
          </div>

          <p className="text-[11px] text-stone-600 mt-4 leading-relaxed font-mono">
            Key highlight: False positive pixels dropped from <strong>3,210</strong> in SAR-VV down to <strong>215</strong> in SAR-UV, demonstrating robust look-alike elimination.
          </p>
        </section>

        {/* Wind Regime Breakdown */}
        <section className="sketch-card p-5">
          <div className="card-heading mb-3">
            <div>
              <p className="eyebrow">Table XII: Regime Sensitivity</p>
              <h2>Improvement Across Wind Regimes</h2>
            </div>
          </div>

          <div className="space-y-3 mt-2">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-300">
              <div className="flex justify-between items-center">
                <strong className="text-xs text-stone-800">1. Low-Wind Regime (0 - 2.5 m/s)</strong>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                  ΔFPR -80.4%
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                Where LWSAs dominate. Median ΔP: <strong>+75.8%</strong> · Median ΔF1: <strong>+68.7%</strong>. The strongest benefit of wind-field coupling.
              </p>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-300">
              <div className="flex justify-between items-center">
                <strong className="text-xs text-stone-800">2. Moderate-Wind Regime (2.5 - 5.0 m/s)</strong>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                  ΔFPR -58.7%
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                Clear false positive reduction in scenes where oil slicks and coastal wake features coexist.
              </p>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-300">
              <div className="flex justify-between items-center">
                <strong className="text-xs text-stone-800">3. High-Wind Regime (&gt; 5.0 m/s)</strong>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-200 text-stone-700">
                  ΔFPR -5.2%
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                Winds naturally generate roughness everywhere. Confirms SAR-UV causes no degradation in high winds.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Loss Function Ablation Table */}
      <section className="sketch-card p-5 mt-6">
        <div className="card-heading mb-3">
          <div>
            <p className="eyebrow">Table IX Ablation Study</p>
            <h2>Loss Function Optimization for Look-Alike Suppression</h2>
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loss Function</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-Score</th>
                <th>False Positive Rate (FPR)</th>
                <th>Selection Rationale</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-emerald-50/50">
                <td>
                  <strong>BCE (Binary Cross-Entropy)</strong>
                  <span className="text-[10px] text-emerald-700 font-bold ml-1.5 font-mono">SELECTED</span>
                </td>
                <td className="mono font-bold text-emerald-800">89.4%</td>
                <td className="mono">83.4%</td>
                <td className="mono">85.7%</td>
                <td className="mono font-bold text-emerald-800">2.6% (Lowest)</td>
                <td className="text-xs text-stone-600">
                  Penalizes oil predictions across entire non-oil calm waters, strictly enforcing conservatism.
                </td>
              </tr>
              <tr>
                <td>Dice Loss</td>
                <td className="mono text-red-700">62.1%</td>
                <td className="mono font-bold text-emerald-700">88.5%</td>
                <td className="mono">73.0%</td>
                <td className="mono text-red-700">14.2%</td>
                <td className="text-xs text-stone-600">
                  Focuses on mask overlap; creates bloated predictions that capture too many ambiguous dark pixels.
                </td>
              </tr>
              <tr>
                <td>BCE + Dice</td>
                <td className="mono">81.5%</td>
                <td className="mono">86.2%</td>
                <td className="mono font-bold">87.1%</td>
                <td className="mono">4.8%</td>
                <td className="text-xs text-stone-600">
                  Competitive F1, but retains higher FPR over large Low-Wind-Speed Areas compared to pure BCE.
                </td>
              </tr>
              <tr>
                <td>Focal Loss</td>
                <td className="mono text-red-700">68.4%</td>
                <td className="mono">85.1%</td>
                <td className="mono">75.8%</td>
                <td className="mono text-red-700">11.9%</td>
                <td className="text-xs text-stone-600">
                  Amplifies hard pixels, which mistakenly focuses model on calm water boundaries that resemble oil.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
