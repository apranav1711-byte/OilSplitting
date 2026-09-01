import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { Wind, AlertOctagon, RotateCw, CheckCircle, ShieldAlert } from "lucide-react";

export default function WindLab() {
  const [perturbMode, setPerturbMode] = useState<"normal" | "mirror" | "zero" | "cross">("normal");
  const [testSpeed, setTestSpeed] = useState(3.6);
  const [testDirection, setTestDirection] = useState(135);

  const experimentData = [
    { mode: "Matched ERA5", f1: 85.7, fpr: 2.6, fill: "#3AAE83" },
    { mode: "Mirrored Wind", f1: 1.9, fpr: 73.2, fill: "#E66C63" },
    { mode: "Zeroed Wind", f1: 51.4, fpr: 48.0, fill: "#F0A646" },
    { mode: "Cross-Scene Wind", f1: 9.7, fpr: 15.7, fill: "#E66C63" },
  ];

  // Dynamic values depending on perturbation
  const currentMetrics = {
    normal: { f1: 85.7, fpr: 2.6, label: "Physically Matched Wind Field", status: "Optimal" },
    mirror: { f1: 1.9, fpr: 73.2, label: "Mirrored Wind Vectors (Inverted Flow)", status: "Severe Collapse" },
    zero: { f1: 51.4, fpr: 48.0, label: "Zero Wind Field (Context Stripped)", status: "Degraded" },
    cross: { f1: 9.7, fpr: 15.7, label: "Cross-Scene Swapped Wind", status: "Mismatched" }
  }[perturbMode];

  return (
    <div className="screen-shell">
      <ScreenHeader
        eyebrow="Diagnostic Stress Testing · IEEE JSTARS Section IV-B2"
        title="Wind Field Perturbation Lab"
      />

      <section className="hand-note note-blue">
        <span>Scientific Validation</span>
        <strong>Proving Physical Coupling vs. Random Input Channels</strong>
        <small>Disrupting wind-backscatter alignment causes immediate detection collapse, verifying genuine environmental physics</small>
      </section>

      {/* Mode Selection Strip */}
      <div className="sketch-card p-5 mb-6">
        <p className="eyebrow">Select Experimental Perturbation State</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <button
            onClick={() => setPerturbMode("normal")}
            className={`p-3 rounded-xl border text-left transition-all ${
              perturbMode === "normal"
                ? "bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-400/20"
                : "bg-white border-stone-300 hover:bg-stone-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800">1. Normal (Matched)</span>
              <CheckCircle size={15} className="text-emerald-600" />
            </div>
            <p className="text-[11px] text-stone-600 mt-1">Collocated ERA5 U10/V10</p>
            <span className="mono text-[10px] font-bold text-emerald-700 mt-1 block">F1: 85.7% · FPR: 2.6%</span>
          </button>

          <button
            onClick={() => setPerturbMode("mirror")}
            className={`p-3 rounded-xl border text-left transition-all ${
              perturbMode === "mirror"
                ? "bg-red-50 border-red-500 shadow-sm ring-2 ring-red-400/20"
                : "bg-white border-stone-300 hover:bg-stone-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-800">2. Mirrored Vectors</span>
              <AlertOctagon size={15} className="text-red-600" />
            </div>
            <p className="text-[11px] text-stone-600 mt-1">U10 → -U10, V10 → -V10</p>
            <span className="mono text-[10px] font-bold text-red-700 mt-1 block">F1: 1.9% · FPR: 73.2%</span>
          </button>

          <button
            onClick={() => setPerturbMode("zero")}
            className={`p-3 rounded-xl border text-left transition-all ${
              perturbMode === "zero"
                ? "bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-400/20"
                : "bg-white border-stone-300 hover:bg-stone-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800">3. Zero Wind Field</span>
              <RotateCw size={15} className="text-amber-600" />
            </div>
            <p className="text-[11px] text-stone-600 mt-1">U10 = 0, V10 = 0 (No context)</p>
            <span className="mono text-[10px] font-bold text-amber-700 mt-1 block">F1: 51.4% · FPR: 48.0%</span>
          </button>

          <button
            onClick={() => setPerturbMode("cross")}
            className={`p-3 rounded-xl border text-left transition-all ${
              perturbMode === "cross"
                ? "bg-red-50 border-red-500 shadow-sm ring-2 ring-red-400/20"
                : "bg-white border-stone-300 hover:bg-stone-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-800">4. Cross-Scene Swap</span>
              <ShieldAlert size={15} className="text-red-600" />
            </div>
            <p className="text-[11px] text-stone-600 mt-1">Wind from another sea area</p>
            <span className="mono text-[10px] font-bold text-red-700 mt-1 block">F1: 9.7% · FPR: 15.7%</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Comparison Chart + Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="sketch-card p-5">
          <div className="card-heading mb-4">
            <div>
              <p className="eyebrow">Empirical Verification (Section IV-B2)</p>
              <h2>F1-Score Under Wind Perturbations</h2>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={experimentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#D9D0C2" strokeDasharray="3 5" />
                <XAxis dataKey="mode" tickLine={false} axisLine={false} tick={{ fill: "#7F7466", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#7F7466", fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1.5px solid #3E3833",
                    background: "#FFFCF4",
                  }}
                />
                <Bar dataKey="f1" fill="#3395FF" radius={[6, 6, 0, 0]} name="F1-Score (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-stone-600 mt-2 font-mono">
            Notice how mirroring the wind causes F1 to collapse from 85.7% to 1.9%, proving the network learns true wind-capillary physics.
          </p>
        </section>

        {/* Interactive Manual Vector Simulator */}
        <section className="sketch-card p-5">
          <div className="card-heading mb-3">
            <div>
              <p className="eyebrow">Manual Vector Adjustment</p>
              <h2>Interactive Wind Dial Simulator</h2>
            </div>
          </div>

          <div className="slider-group">
            <label>
              <span>Wind Speed (m/s)</span>
              <b>{testSpeed.toFixed(1)} m/s</b>
            </label>
            <input
              type="range"
              min="0.0"
              max="12.0"
              step="0.2"
              value={testSpeed}
              onChange={(e) => setTestSpeed(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-stone-500 font-mono">
              <span>0 m/s (Severe LWSA)</span>
              <span>2.5 m/s (Threshold)</span>
              <span>12 m/s (Rough Sea)</span>
            </div>
          </div>

          <div className="slider-group mt-4">
            <label>
              <span>Wind Direction (Degrees)</span>
              <b>{testDirection}°</b>
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={testDirection}
              onChange={(e) => setTestDirection(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Real-Time Mathematical Response Box */}
          <div className="cost-result mt-4">
            <span className="mono uppercase text-[10px]">Predicted Model Regime</span>
            <strong className="text-lg">
              {testSpeed < 2.0
                ? "⚠️ Specular Calm Water: Look-Alikes Likely"
                : testSpeed < 3.0
                ? "⚡ Boundary Zone: High Wind Coupling Sensitivity"
                : "✅ Fully Developed Sea: High Slick Contrast"}
            </strong>
            <small>
              Zonal U10: {(testSpeed * Math.cos((testDirection * Math.PI) / 180)).toFixed(2)} m/s · Meridional V10:{" "}
              {(testSpeed * Math.sin((testDirection * Math.PI) / 180)).toFixed(2)} m/s
            </small>
          </div>
        </section>
      </div>
    </div>
  );
}
