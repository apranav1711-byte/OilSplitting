import { useState, useRef, useEffect } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { historicalSpills } from "@/lib/demoData";
import { Sliders, Eye, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

export default function DetectionStudio() {
  const [selectedCase, setSelectedCase] = useState("EXP-01");
  const [threshold, setThreshold] = useState(0.5);
  const [showQuivers, setShowQuivers] = useState(true);

  const canvasSarRef = useRef<HTMLCanvasElement>(null);
  const canvasVvRef = useRef<HTMLCanvasElement>(null);
  const canvasUvRef = useRef<HTMLCanvasElement>(null);

  const incident = historicalSpills.find((s) => s.id === selectedCase) || historicalSpills[0];

  useEffect(() => {
    drawSyntheticSAR();
  }, [selectedCase, threshold, showQuivers]);

  const drawSyntheticSAR = () => {
    const sarCanvas = canvasSarRef.current;
    const vvCanvas = canvasVvRef.current;
    const uvCanvas = canvasUvRef.current;
    if (!sarCanvas || !vvCanvas || !uvCanvas) return;

    const size = 320;
    sarCanvas.width = size;
    sarCanvas.height = size;
    vvCanvas.width = size;
    vvCanvas.height = size;
    uvCanvas.width = size;
    uvCanvas.height = size;

    const ctxSar = sarCanvas.getContext("2d")!;
    const ctxVv = vvCanvas.getContext("2d")!;
    const ctxUv = uvCanvas.getContext("2d")!;

    // 1. Draw Base SAR Sea Texture
    ctxSar.fillStyle = "#1e293b";
    ctxSar.fillRect(0, 0, size, size);

    // Add radar speckle
    const imgData = ctxSar.getImageData(0, 0, size, size);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const speckle = (Math.random() - 0.5) * 40;
      const base = 48 + speckle;
      imgData.data[i] = Math.max(10, Math.min(255, base));
      imgData.data[i + 1] = Math.max(10, Math.min(255, base + 2));
      imgData.data[i + 2] = Math.max(10, Math.min(255, base + 8));
    }
    ctxSar.putImageData(imgData, 0, 0);

    // Draw look-alike zone (LWSA or LSI)
    if (selectedCase === "EXP-01") {
      // Caspian Sea: Bottom left large LWSA calm water
      ctxSar.fillStyle = "#0c1322";
      ctxSar.beginPath();
      ctxSar.ellipse(90, 230, 85, 65, 0, 0, Math.PI * 2);
      ctxSar.fill();
    } else if (selectedCase === "EXP-02") {
      // Ionian Sea: Island + leeward wake
      ctxSar.fillStyle = "#cbd5e1"; // Island
      ctxSar.beginPath();
      ctxSar.ellipse(100, 150, 18, 14, 0, 0, Math.PI * 2);
      ctxSar.fill();

      ctxSar.fillStyle = "#090e18"; // Leeward wake downstream
      ctxSar.beginPath();
      ctxSar.ellipse(190, 152, 75, 22, 0, 0, Math.PI * 2);
      ctxSar.fill();
    } else {
      // Red Sea: small low-wind pocket in top right
      ctxSar.fillStyle = "#090e18";
      ctxSar.beginPath();
      ctxSar.ellipse(250, 60, 45, 35, 0, 0, Math.PI * 2);
      ctxSar.fill();
    }

    // Draw genuine oil slick (dark filament)
    ctxSar.strokeStyle = "#05070d";
    ctxSar.lineWidth = 6;
    ctxSar.lineCap = "round";
    ctxSar.beginPath();
    if (selectedCase === "EXP-01") {
      ctxSar.moveTo(170, 120);
      ctxSar.bezierCurveTo(200, 140, 220, 180, 245, 230);
      ctxSar.stroke();
      // Platform artifact
      ctxSar.fillStyle = "#ffffff";
      ctxSar.fillRect(167, 117, 6, 6);
    } else if (selectedCase === "EXP-02") {
      ctxSar.moveTo(180, 70);
      ctxSar.bezierCurveTo(220, 85, 260, 110, 290, 140);
      ctxSar.stroke();
    } else {
      ctxSar.moveTo(80, 110);
      ctxSar.bezierCurveTo(140, 150, 190, 190, 240, 240);
      ctxSar.stroke();
      ctxSar.moveTo(100, 90);
      ctxSar.bezierCurveTo(160, 130, 210, 170, 260, 220);
      ctxSar.stroke();
    }

    // Quiver wind vectors
    if (showQuivers) {
      ctxSar.strokeStyle = "#10b981";
      ctxSar.fillStyle = "#10b981";
      ctxSar.lineWidth = 1.5;
      const step = 45;
      for (let y = 30; y < size; y += step) {
        for (let x = 30; x < size; x += step) {
          ctxSar.beginPath();
          ctxSar.moveTo(x, y);
          ctxSar.lineTo(x + 16, y - 4);
          ctxSar.stroke();
          // Arrow head
          ctxSar.beginPath();
          ctxSar.arc(x + 16, y - 4, 2.5, 0, Math.PI * 2);
          ctxSar.fill();
        }
      }
    }

    // 2. Draw SAR-VV Baseline Detection (Fails on calm water!)
    ctxVv.fillStyle = "#0f172a";
    ctxVv.fillRect(0, 0, size, size);
    ctxVv.fillStyle = "#ef4444"; // Red for oil alarm

    // True slick detected
    ctxVv.strokeStyle = "#ef4444";
    ctxVv.lineWidth = 8;
    ctxVv.beginPath();
    if (selectedCase === "EXP-01") {
      ctxVv.moveTo(170, 120);
      ctxVv.bezierCurveTo(200, 140, 220, 180, 245, 230);
      ctxVv.stroke();
      // FALSE POSITIVE: Falsely flags entire LWSA calm water!
      ctxVv.beginPath();
      ctxVv.ellipse(90, 230, 80, 60, 0, 0, Math.PI * 2);
      ctxVv.fill();
    } else if (selectedCase === "EXP-02") {
      ctxVv.moveTo(180, 70);
      ctxVv.bezierCurveTo(220, 85, 260, 110, 290, 140);
      ctxVv.stroke();
      // FALSE POSITIVE: Falsely flags island wake!
      ctxVv.beginPath();
      ctxVv.ellipse(190, 152, 70, 20, 0, 0, Math.PI * 2);
      ctxVv.fill();
    } else {
      ctxVv.moveTo(80, 110);
      ctxVv.bezierCurveTo(140, 150, 190, 190, 240, 240);
      ctxVv.stroke();
      ctxVv.moveTo(100, 90);
      ctxVv.bezierCurveTo(160, 130, 210, 170, 260, 220);
      ctxVv.stroke();
      // Small false alarm in pocket
      ctxVv.beginPath();
      ctxVv.ellipse(250, 60, 40, 30, 0, 0, Math.PI * 2);
      ctxVv.fill();
    }

    // 3. Draw SAR-UV Proposed Detection (Cleanly suppresses false alarms!)
    ctxUv.fillStyle = "#0f172a";
    ctxUv.fillRect(0, 0, size, size);
    ctxUv.strokeStyle = "#38bdf8"; // Cyan/Blue for verified oil
    ctxUv.lineWidth = 8;
    ctxUv.beginPath();
    if (selectedCase === "EXP-01") {
      ctxUv.moveTo(170, 120);
      ctxUv.bezierCurveTo(200, 140, 220, 180, 245, 230);
      ctxUv.stroke();
      // Notice: LWSA is cleanly SUPPRESSED! (Zero false alarms)
    } else if (selectedCase === "EXP-02") {
      ctxUv.moveTo(180, 70);
      ctxUv.bezierCurveTo(220, 85, 260, 110, 290, 140);
      ctxUv.stroke();
      // Island wake is cleanly SUPPRESSED!
    } else {
      ctxUv.moveTo(80, 110);
      ctxUv.bezierCurveTo(140, 150, 190, 190, 240, 240);
      ctxUv.stroke();
      ctxUv.moveTo(100, 90);
      ctxUv.bezierCurveTo(160, 130, 210, 170, 260, 220);
      ctxUv.stroke();
    }
  };

  return (
    <div className="screen-shell">
      <ScreenHeader
        eyebrow="Sentinel-1 SAR + ERA5 Wind Vector Processing Studio"
        title="Dual Model Detection Studio"
      />

      <section className="hand-note note-blue">
        <span>Dual inference active</span>
        <strong>Evaluating {incident.region} ({incident.source})</strong>
        <small>Real-time comparative analysis between baseline SAR-VV and wind-integrated SAR-UV</small>
      </section>

      {/* Control Strip */}
      <div className="sketch-card filter-strip">
        <div className="filter-copy">
          <strong>Select Scenario:</strong>
          <span>Choose from benchmark satellite scenes:</span>
        </div>
        <div className="filter-controls">
          <select
            value={selectedCase}
            onChange={(e) => setSelectedCase(e.target.value)}
            className="font-mono"
          >
            {historicalSpills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.region} ({s.spillType}) - Wind {s.meanWind} m/s
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={showQuivers}
              onChange={(e) => setShowQuivers(e.target.checked)}
            />
            Wind Vectors (U10/V10)
          </label>
        </div>
      </div>

      {/* 3-Panel Visual Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Panel 1: SAR VV + Wind Quivers */}
        <div className="sketch-card p-4">
          <div className="card-heading mb-3">
            <div>
              <p className="eyebrow">Input Satellite Data</p>
              <h3 className="font-bold text-sm">SAR Backscatter (VV) &amp; Winds</h3>
            </div>
          </div>
          <div className="flex justify-center bg-stone-900 rounded-xl p-2">
            <canvas ref={canvasSarRef} className="rounded-lg shadow-inner max-w-full" />
          </div>
          <div className="mt-3 text-[11px] text-stone-600 leading-relaxed font-mono">
            Ambient Wind: <strong>{incident.meanWind} m/s</strong> · {incident.lookAlikeCondition}
          </div>
        </div>

        {/* Panel 2: Baseline SAR-VV */}
        <div className="sketch-card p-4 border-red-800/40">
          <div className="card-heading mb-3">
            <div>
              <p className="eyebrow text-red-600">❌ Baseline: Single-Channel</p>
              <h3 className="font-bold text-sm text-red-700">SAR-VV (False Alarms)</h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-100 text-red-700">
              FPR: {incident.fprLWSA_VV > 0 ? incident.fprLWSA_VV : incident.fprLSI_VV}%
            </span>
          </div>
          <div className="flex justify-center bg-stone-900 rounded-xl p-2 border border-red-300/40">
            <canvas ref={canvasVvRef} className="rounded-lg shadow-inner max-w-full" />
          </div>
          <p className="mt-3 text-[11px] text-red-600 leading-relaxed">
            Severe misjudgment: classifies calm waters / island wakes as oil spills due to lack of wind context.
          </p>
        </div>

        {/* Panel 3: Proposed SAR-UV */}
        <div className="sketch-card p-4 border-sky-800/40">
          <div className="card-heading mb-3">
            <div>
              <p className="eyebrow text-sky-600">✅ Proposed: Wind-Integrated</p>
              <h3 className="font-bold text-sm text-sky-700">SAR-UV with UNet++ SCSE</h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-700">
              FPR: {incident.fprLWSA_UV > 0 ? incident.fprLWSA_UV : incident.fprLSI_UV}%
            </span>
          </div>
          <div className="flex justify-center bg-stone-900 rounded-xl p-2 border border-sky-300/40">
            <canvas ref={canvasUvRef} className="rounded-lg shadow-inner max-w-full" />
          </div>
          <p className="mt-3 text-[11px] text-emerald-700 font-semibold leading-relaxed">
            Clean suppression: suppresses look-alikes across calm zones while preserving true slick boundaries.
          </p>
        </div>
      </div>

      {/* Comparative Scorecard Card */}
      <section className="sketch-card p-5">
        <div className="card-heading mb-4">
          <div>
            <p className="eyebrow">Rigorous Evaluation Benchmark</p>
            <h2>Quantitative Delta Scorecard: {incident.region}</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-stone-50 rounded-xl border border-dashed border-stone-300">
            <span className="text-[11px] text-stone-500 font-mono uppercase block">Precision</span>
            <div className="text-xl font-bold text-stone-800 mt-1">
              {incident.precisionUV}%
            </div>
            <div className="text-xs font-bold text-emerald-600 mt-0.5">
              +{(incident.precisionUV - incident.precisionVV).toFixed(1)}% vs SAR-VV
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-dashed border-stone-300">
            <span className="text-[11px] text-stone-500 font-mono uppercase block">F1-Score</span>
            <div className="text-xl font-bold text-stone-800 mt-1">
              {incident.f1UV}%
            </div>
            <div className="text-xs font-bold text-emerald-600 mt-0.5">
              +{(incident.f1UV - incident.f1VV).toFixed(1)}% vs SAR-VV
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-dashed border-stone-300">
            <span className="text-[11px] text-stone-500 font-mono uppercase block">Recall</span>
            <div className="text-xl font-bold text-stone-800 mt-1">
              {incident.recallUV}%
            </div>
            <div className="text-xs font-semibold text-stone-500 mt-0.5">
              Preserved detection integrity
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-dashed border-emerald-300">
            <span className="text-[11px] text-emerald-800 font-mono uppercase block">Look-Alike Suppression</span>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {incident.fprLWSA_VV > 0
                ? `${incident.fprLWSA_VV}% → ${incident.fprLWSA_UV}%`
                : `${incident.fprLSI_VV}% → ${incident.fprLSI_UV}%`}
            </div>
            <div className="text-xs font-bold text-emerald-800 mt-0.5">
              {incident.fprLWSA_VV > 0 ? "Calm Water Cleared" : "Island Wake Cleared"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
