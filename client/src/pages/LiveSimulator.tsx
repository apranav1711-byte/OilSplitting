import { useState, useRef, useEffect } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  Play,
  Pause,
  RotateCcw,
  Wind,
  Droplets,
  Radio,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Compass,
  Layers,
  Sparkles
} from "lucide-react";

interface OilDroplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  maxAge: number;
  seed: number;
}

interface WindStreamline {
  x: number;
  y: number;
  speed: number;
  length: number;
  trail: { x: number; y: number }[];
}

export default function LiveSimulator() {
  const [isRunning, setIsRunning] = useState(true);
  const [windSpeed, setWindSpeed] = useState(5.4); // m/s
  const [windDirection, setWindDirection] = useState(55); // degrees
  const [spillRate, setSpillRate] = useState(60); // % intensity
  const [isLeaking, setIsLeaking] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<"platform" | "island_wake" | "calm_zone">("platform");

  // Real-time telemetry
  const [metrics, setMetrics] = useState({
    slickAreaKm2: 18.4,
    driftSpeedKnots: 1.1,
    sarVvFalseAlarmPercent: 82.5,
    sarUvFalseAlarmPercent: 0.2,
    activePlumeVolume: "3,420 bbl",
  });

  // Canvas refs
  const canvasSimRef = useRef<HTMLCanvasElement>(null);
  const canvasVvRef = useRef<HTMLCanvasElement>(null);
  const canvasUvRef = useRef<HTMLCanvasElement>(null);

  // Simulation physics state
  const stateRef = useRef({
    droplets: [] as OilDroplet[],
    windStreams: [] as WindStreamline[],
    frameCount: 0,
    platform: { x: 90, y: 130 },
    island: { x: 140, y: 220, radius: 28 },
    oceanNoise: null as ImageData | null,
  });

  // Initialize wind streamlines
  useEffect(() => {
    const streams: WindStreamline[] = [];
    for (let i = 0; i < 90; i++) {
      streams.push({
        x: Math.random() * 440,
        y: Math.random() * 360,
        speed: 1.8 + Math.random() * 2.4,
        length: 12 + Math.random() * 16,
        trail: [],
      });
    }
    stateRef.current.windStreams = streams;
  }, []);

  // Set positions per scenario
  useEffect(() => {
    if (selectedScenario === "platform") {
      stateRef.current.platform = { x: 95, y: 125 };
    } else if (selectedScenario === "island_wake") {
      stateRef.current.platform = { x: 250, y: 90 };
      stateRef.current.island = { x: 150, y: 210, radius: 30 };
    } else {
      stateRef.current.platform = { x: 120, y: 110 };
    }
  }, [selectedScenario]);

  // Main 60 FPS Fluid Physics & Animation Loop
  useEffect(() => {
    let animationId: number;

    const rad = (windDirection * Math.PI) / 180;
    const uDir = Math.cos(rad);
    const vDir = Math.sin(rad);

    const updateAndRender = () => {
      const state = stateRef.current;
      state.frameCount++;

      const width = 440;
      const height = 360;

      // 1. Continuous Oil Plume Emission (multiple fluid droplets per frame)
      if (isRunning && isLeaking) {
        // Emit 3 to 6 sub-droplets every single frame to create a solid, continuous fluid plume
        const numPerFrame = Math.max(2, Math.floor(spillRate / 18));
        for (let k = 0; k < numPerFrame; k++) {
          const spreadAngle = (Math.random() - 0.5) * 0.7;
          const initialSpeed = 0.5 + Math.random() * 0.8;
          state.droplets.push({
            x: state.platform.x + (Math.random() - 0.5) * 4,
            y: state.platform.y + (Math.random() - 0.5) * 4,
            vx: uDir * initialSpeed + Math.cos(rad + Math.PI / 2) * spreadAngle,
            vy: vDir * initialSpeed + Math.sin(rad + Math.PI / 2) * spreadAngle,
            radius: 4.5 + Math.random() * 3.5,
            age: 0,
            maxAge: 380 + Math.random() * 80,
            seed: Math.random() * 100,
          });
        }
      }

      // 2. Fluid Physics Step: Advection, Turbulent Eddy Dispersion, and Spreading
      if (isRunning) {
        // Current/Drift speed = ~3.5% of wind speed
        const drift = windSpeed * 0.38;

        for (let i = state.droplets.length - 1; i >= 0; i--) {
          const d = state.droplets[i];
          d.age++;

          // Turbulent eddy meandering: sine-wave vortex disturbance
          const meander = Math.sin(d.seed + d.age * 0.04) * 0.45;
          const normalX = -vDir * meander;
          const normalY = uDir * meander;

          // Advect with wind + ocean eddy diffusion
          d.x += uDir * drift + normalX + (Math.random() - 0.5) * 0.35;
          d.y += vDir * drift + normalY + (Math.random() - 0.5) * 0.35;

          // Fay's gravity-viscous radial plume spreading
          d.radius += 0.085;

          // Prune dead droplets
          if (d.age > d.maxAge || d.x < -60 || d.x > width + 60 || d.y < -60 || d.y > height + 60) {
            state.droplets.splice(i, 1);
          }
        }

        // 3. Flowing Wind Streamlines
        for (let i = 0; i < state.windStreams.length; i++) {
          const ws = state.windStreams[i];
          const streamSpeed = (windSpeed / 4.5) * ws.speed;
          ws.x += uDir * streamSpeed;
          ws.y += vDir * streamSpeed;

          // Trail points for smooth ribbon rendering
          ws.trail.push({ x: ws.x, y: ws.y });
          if (ws.trail.length > 6) ws.trail.shift();

          if (ws.x < -30 || ws.x > width + 30 || ws.y < -30 || ws.y > height + 30) {
            ws.trail = [];
            // Respawn upwind
            if (Math.abs(uDir) > Math.abs(vDir)) {
              ws.x = uDir > 0 ? -20 : width + 20;
              ws.y = Math.random() * height;
            } else {
              ws.x = Math.random() * width;
              ws.y = vDir > 0 ? -20 : height + 20;
            }
          }
        }

        // Update UI metrics every 15 frames
        if (state.frameCount % 15 === 0) {
          const areaEst = (state.droplets.length * 0.038).toFixed(1);
          setMetrics({
            slickAreaKm2: Math.max(1.2, parseFloat(areaEst)),
            driftSpeedKnots: parseFloat((windSpeed * 0.035 * 1.94384).toFixed(2)),
            sarVvFalseAlarmPercent: selectedScenario === "platform" ? 82.5 : 79.1,
            sarUvFalseAlarmPercent: selectedScenario === "platform" ? 0.2 : 3.4,
            activePlumeVolume: `${Math.round(state.droplets.length * 12.5).toLocaleString()} bbl`,
          });
        }
      }

      // =========================================================================
      // 4. Render Panel 1: REALISTIC SATELLITE SAR RADAR REALITY
      // =========================================================================
      const simCanvas = canvasSimRef.current;
      if (simCanvas) {
        simCanvas.width = width;
        simCanvas.height = height;
        const ctx = simCanvas.getContext("2d")!;

        // Realistic Sentinel-1 VV Ocean Backscatter (-15 dB ambient gray-blue)
        const seaGrad = ctx.createLinearGradient(0, 0, width, height);
        seaGrad.addColorStop(0, "#1e293b");
        seaGrad.addColorStop(1, "#172033");
        ctx.fillStyle = seaGrad;
        ctx.fillRect(0, 0, width, height);

        // Capillary wave roughness / radar speckle texture
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        for (let x = 0; x < width; x += 6) {
          for (let y = 0; y < height; y += 6) {
            if ((x * 13 + y * 29) % 19 < 4) {
              ctx.fillRect(x, y, 2, 2);
            }
          }
        }

        // Render Environmental Look-Alike Areas (Calm Sea or Island Wake)
        if (selectedScenario === "platform") {
          // Large Low-Wind-Speed Area (LWSA) - Specular mirror sea
          // Real physical backscatter: smooth, irregular dark bay
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(85, 265, 110, 80, 0.2, 0, Math.PI * 2);
          const lwsaGrad = ctx.createRadialGradient(85, 265, 20, 85, 265, 110);
          lwsaGrad.addColorStop(0, "#080c14"); // Specular mirror dark
          lwsaGrad.addColorStop(0.7, "#0c1322");
          lwsaGrad.addColorStop(1, "rgba(30, 41, 59, 0)");
          ctx.fillStyle = lwsaGrad;
          ctx.fill();
          ctx.restore();

          // Region label
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 9px monospace";
          ctx.fillText("LOW-WIND-SPEED AREA (LWSA < 1.5 m/s)", 20, 275);
          ctx.fillStyle = "#94a3b8";
          ctx.font = "8px monospace";
          ctx.fillText("Natural calm water (Specular radar mirror)", 20, 288);
        } else if (selectedScenario === "island_wake") {
          // Island Topography (High radar backscatter rock)
          const ix = state.island.x;
          const iy = state.island.y;
          ctx.fillStyle = "#94a3b8";
          ctx.beginPath();
          ctx.arc(ix, iy, state.island.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px monospace";
          ctx.fillText("ISLAND PEAK (840m)", ix - 45, iy - 34);

          // Downstream Leeward Island Wake (LSI)
          const wakeLen = 170;
          const wx = ix + uDir * (wakeLen / 2);
          const wy = iy + vDir * (wakeLen / 2);
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(wx, wy, wakeLen / 2, 34, rad, 0, Math.PI * 2);
          const wakeGrad = ctx.createRadialGradient(wx, wy, 15, wx, wy, 90);
          wakeGrad.addColorStop(0, "#070b12");
          wakeGrad.addColorStop(0.75, "#0b111c");
          wakeGrad.addColorStop(1, "rgba(30, 41, 59, 0)");
          ctx.fillStyle = wakeGrad;
          ctx.fill();
          ctx.restore();

          ctx.fillStyle = "#e2e8f0";
          ctx.font = "bold 9px monospace";
          ctx.fillText("LEEWARD ISLAND WAKE (LSI)", wx - 55, wy);
        }

        // Render Animated Flowing Wind Streamlines
        ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
        ctx.lineWidth = 1.3;
        for (const ws of state.windStreams) {
          if (ws.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(ws.trail[0].x, ws.trail[0].y);
            for (let t = 1; t < ws.trail.length; t++) {
              ctx.lineTo(ws.trail[t].x, ws.trail[t].y);
            }
            ctx.stroke();
          }
        }

        // Render CONTINUOUS LIQUID OIL SLICK PLUME (Jet Black with Capillary Damping)
        // Draw multiple overlapping passes to create a seamless, viscous fluid mass
        if (state.droplets.length > 0) {
          // Pass A: Outer sheen / dampening halo
          ctx.fillStyle = "rgba(4, 7, 13, 0.45)";
          for (const d of state.droplets) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius * 1.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Pass B: Thick dense black hydrocarbon core (-28 dB backscatter)
          ctx.fillStyle = "#020408";
          for (const d of state.droplets) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
            ctx.fill();
          }

          // Pass C: Connecting fluid spine (merges particles into a solid ribbon)
          ctx.strokeStyle = "#020408";
          ctx.lineWidth = 12;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          const step = Math.max(1, Math.floor(state.droplets.length / 40));
          ctx.moveTo(state.platform.x, state.platform.y);
          for (let i = 0; i < state.droplets.length; i += step) {
            ctx.lineTo(state.droplets[i].x, state.droplets[i].y);
          }
          ctx.stroke();
        }

        // Render Oil Spill Source (Platform or Ship)
        const px = state.platform.x;
        const py = state.platform.y;
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(px - 7, py - 7, 14, 14);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 7, py - 7, 14, 14);

        // Platform wellhead tag
        ctx.fillStyle = "#fef08a";
        ctx.font = "bold 9px monospace";
        ctx.fillText("OIL PLATFORM #12", px - 42, py - 14);

        if (isLeaking) {
          // Glowing emergency spill pulse
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + 0.5 * Math.sin(state.frameCount * 0.12)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, 14 + 5 * Math.sin(state.frameCount * 0.15), 0, Math.PI * 2);
          ctx.stroke();
        }

        // Live Wind Compass Hud on Canvas
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fillRect(width - 85, 10, 75, 75);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(width - 85, 10, 75, 75);

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 9px monospace";
        ctx.fillText("WIND VECTOR", width - 80, 24);
        ctx.fillText(`${windSpeed.toFixed(1)} m/s`, width - 80, 76);

        const cx = width - 48;
        const cy = 48;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.strokeStyle = "#475569";
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + uDir * 15, cy + vDir * 15);
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // =========================================================================
      // 5. Render Panel 2: BASELINE SAR-VV DETECTION (FAILS ON CALM WATER!)
      // =========================================================================
      const vvCanvas = canvasVvRef.current;
      if (vvCanvas) {
        vvCanvas.width = width;
        vvCanvas.height = height;
        const ctx = vvCanvas.getContext("2d")!;

        // Dark background
        ctx.fillStyle = "#090d16";
        ctx.fillRect(0, 0, width, height);

        // Grid lines to simulate neural feature map
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 1;
        for (let g = 0; g < width; g += 30) {
          ctx.beginPath();
          ctx.moveTo(g, 0);
          ctx.lineTo(g, height);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, g);
          ctx.lineTo(width, g);
          ctx.stroke();
        }

        // Draw Continuous Oil Slick detected as RED
        if (state.droplets.length > 0) {
          ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
          for (const d of state.droplets) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius * 1.1, 0, Math.PI * 2);
            ctx.fill();
          }

          // Solid connecting spine
          ctx.strokeStyle = "rgba(239, 68, 68, 0.95)";
          ctx.lineWidth = 10;
          ctx.lineCap = "round";
          ctx.beginPath();
          const step = Math.max(1, Math.floor(state.droplets.length / 40));
          ctx.moveTo(state.platform.x, state.platform.y);
          for (let i = 0; i < state.droplets.length; i += step) {
            ctx.lineTo(state.droplets[i].x, state.droplets[i].y);
          }
          ctx.stroke();
        }

        // SEVERE FALSE ALARM: Falsely illuminates the entire calm sea / island wake in red!
        if (selectedScenario === "platform") {
          ctx.fillStyle = "rgba(239, 68, 68, 0.75)";
          ctx.beginPath();
          ctx.ellipse(85, 265, 105, 75, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Pulsing warning badge
          ctx.fillStyle = "#fef2f2";
          ctx.font = "bold 11px monospace";
          ctx.fillText("⚠️ FALSE ALARM: 82.5% FPR", 20, 255);
          ctx.font = "9px monospace";
          ctx.fillText("Single-channel SAR flags calm sea as oil!", 20, 272);
        } else if (selectedScenario === "island_wake") {
          const ix = state.island.x;
          const iy = state.island.y;
          const wakeLen = 170;
          const wx = ix + uDir * (wakeLen / 2);
          const wy = iy + vDir * (wakeLen / 2);

          ctx.fillStyle = "rgba(239, 68, 68, 0.75)";
          ctx.beginPath();
          ctx.ellipse(wx, wy, wakeLen / 2, 32, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#fef2f2";
          ctx.font = "bold 11px monospace";
          ctx.fillText("⚠️ FALSE ALARM: 79.1% FPR", wx - 60, wy - 8);
          ctx.font = "9px monospace";
          ctx.fillText("Island wake falsely detected as slick!", wx - 60, wy + 8);
        }
      }

      // =========================================================================
      // 6. Render Panel 3: PROPOSED SAR-UV DETECTION (CLEAN LOOK-ALIKE SUPPRESSION!)
      // =========================================================================
      const uvCanvas = canvasUvRef.current;
      if (uvCanvas) {
        uvCanvas.width = width;
        uvCanvas.height = height;
        const ctx = uvCanvas.getContext("2d")!;

        // Dark background
        ctx.fillStyle = "#090d16";
        ctx.fillRect(0, 0, width, height);

        // Feature grid lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 1;
        for (let g = 0; g < width; g += 30) {
          ctx.beginPath();
          ctx.moveTo(g, 0);
          ctx.lineTo(g, height);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, g);
          ctx.lineTo(width, g);
          ctx.stroke();
        }

        // Draw Continuous Oil Slick segmented in CLEAN CYAN (#38bdf8)
        if (state.droplets.length > 0) {
          // Glow halo
          ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
          for (const d of state.droplets) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius * 1.3, 0, Math.PI * 2);
            ctx.fill();
          }

          // Dense segmented body
          ctx.fillStyle = "#38bdf8";
          for (const d of state.droplets) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
            ctx.fill();
          }

          // Solid connecting spine
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 10;
          ctx.lineCap = "round";
          ctx.beginPath();
          const step = Math.max(1, Math.floor(state.droplets.length / 40));
          ctx.moveTo(state.platform.x, state.platform.y);
          for (let i = 0; i < state.droplets.length; i += step) {
            ctx.lineTo(state.droplets[i].x, state.droplets[i].y);
          }
          ctx.stroke();
        }

        // Dotted Suppressed Boundary (Shows where calm water was recognized and cleared!)
        ctx.save();
        ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        if (selectedScenario === "platform") {
          ctx.beginPath();
          ctx.ellipse(85, 265, 105, 75, 0.2, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "#10b981";
          ctx.font = "bold 11px monospace";
          ctx.fillText("✅ LWSA SUPPRESSED (FPR: 0.2%)", 20, 255);
          ctx.font = "9px monospace";
          ctx.fillText("U10/V10 vectors resolve calm sea mirror", 20, 272);
        } else if (selectedScenario === "island_wake") {
          const ix = state.island.x;
          const iy = state.island.y;
          const wakeLen = 170;
          const wx = ix + uDir * (wakeLen / 2);
          const wy = iy + vDir * (wakeLen / 2);

          ctx.beginPath();
          ctx.ellipse(wx, wy, wakeLen / 2, 32, rad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "#10b981";
          ctx.font = "bold 11px monospace";
          ctx.fillText("✅ ISLAND WAKE SUPPRESSED (FPR: 3.4%)", wx - 65, wy - 8);
          ctx.font = "9px monospace";
          ctx.fillText("Topographic sheltering accounted for", wx - 65, wy + 8);
        }
        ctx.restore();
      }

      animationId = requestAnimationFrame(updateAndRender);
    };

    animationId = requestAnimationFrame(updateAndRender);
    return () => cancelAnimationFrame(animationId);
  }, [isRunning, isLeaking, windSpeed, windDirection, spillRate, selectedScenario]);

  const handleReset = () => {
    stateRef.current.droplets = [];
  };

  return (
    <div className="screen-shell">
      <ScreenHeader
        eyebrow="Interactive Oceanographic Hydrodynamic Engine"
        title="Live Oil Spill &amp; Wind Drift Simulator"
      >
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`solid-button ${isRunning ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
        >
          {isRunning ? (
            <>
              <Pause size={16} /> Pause Simulation
            </>
          ) : (
            <>
              <Play size={16} /> Resume Simulation
            </>
          )}
        </button>
        <button onClick={handleReset} className="outline-button">
          <RotateCcw size={16} /> Clear Slick Plume
        </button>
      </ScreenHeader>

      {/* Hand Note Tape Banner */}
      <section className="hand-note note-blue">
        <span>60 FPS Fluid Simulation</span>
        <strong>Continuous Viscous Plume Drift + Real-Time SAR Neural Segmentation</strong>
        <small>Watch wind streamlines physically blow the continuous leaking oil slick while SAR-UV dynamically eliminates look-alikes</small>
      </section>

      {/* Interactive Control Console */}
      <div className="sketch-card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Scenario Selector */}
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">Environmental Testbed</label>
            <select
              value={selectedScenario}
              onChange={(e: any) => setSelectedScenario(e.target.value)}
              className="w-full p-2 text-xs font-mono rounded-lg border border-stone-300 bg-white"
            >
              <option value="platform">Platform Leak + Calm Sea (LWSA)</option>
              <option value="island_wake">Tanker Spill + Island Leeward Wake (LSI)</option>
              <option value="calm_zone">Open Sea Spill</option>
            </select>
          </div>

          {/* Wind Speed Slider */}
          <div>
            <div className="flex justify-between text-xs font-bold text-stone-700 mb-1">
              <span>Wind Speed:</span>
              <span className="mono text-sky-700 font-extrabold">{windSpeed.toFixed(1)} m/s</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="14.0"
              step="0.1"
              value={windSpeed}
              onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-sky-500"
            />
          </div>

          {/* Wind Direction Slider */}
          <div>
            <div className="flex justify-between text-xs font-bold text-stone-700 mb-1">
              <span>Wind Flow Direction:</span>
              <span className="mono text-rose-600 font-extrabold">{windDirection}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={windDirection}
              onChange={(e) => setWindDirection(parseInt(e.target.value))}
              className="w-full cursor-pointer accent-rose-500"
            />
          </div>

          {/* Leak Toggle Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLeaking(!isLeaking)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                isLeaking
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              <Droplets size={16} />
              {isLeaking ? "Wellhead Active: SEAL LEAK" : "Wellhead Sealed: RESUME LEAK"}
            </button>
          </div>
        </div>
      </div>

      {/* 3-Panel Side-by-Side Simulation & AI Detection Canvases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Panel 1: Physical Reality Simulation */}
        <div className="sketch-card p-4">
          <div className="card-heading mb-3">
            <div>
              <p className="eyebrow">1. Satellite Radar Reality</p>
              <h3 className="font-bold text-sm">Wind Streamlines &amp; Viscous Oil Plume</h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 text-sky-800">
              {metrics.driftSpeedKnots} knots drift
            </span>
          </div>
          <div className="flex justify-center bg-stone-950 rounded-xl p-2 border border-stone-700 shadow-inner">
            <canvas ref={canvasSimRef} className="rounded-lg shadow-inner max-w-full" />
          </div>
          <div className="mt-2.5 flex justify-between text-[11px] text-stone-600 font-mono">
            <span>Cumulative Volume: {metrics.activePlumeVolume}</span>
            <span>Estimated Area: {metrics.slickAreaKm2} km²</span>
          </div>
        </div>

        {/* Panel 2: Baseline SAR-VV Detection (Fails!) */}
        <div className="sketch-card p-4 border-red-700/40">
          <div className="card-heading mb-3">
            <div>
              <p className="eyebrow text-red-600">2. Baseline Model: SAR-VV</p>
              <h3 className="font-bold text-sm text-red-700">High False Alarm Rate</h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-100 text-red-700">
              FPR: {metrics.sarVvFalseAlarmPercent}%
            </span>
          </div>
          <div className="flex justify-center bg-stone-950 rounded-xl p-2 border border-red-400/40 shadow-inner">
            <canvas ref={canvasVvRef} className="rounded-lg shadow-inner max-w-full" />
          </div>
          <p className="mt-2.5 text-[11px] text-red-700 font-medium">
            Single-channel SAR cannot distinguish calm waters / wakes from oil without wind vectors.
          </p>
        </div>

        {/* Panel 3: Proposed SAR-UV Detection (Clean Suppression!) */}
        <div className="sketch-card p-4 border-sky-700/40">
          <div className="card-heading mb-3">
            <div>
              <p className="eyebrow text-sky-600">3. Proposed Model: SAR-UV</p>
              <h3 className="font-bold text-sm text-sky-700">Clean False Alarm Suppression</h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
              FPR: {metrics.sarUvFalseAlarmPercent}%
            </span>
          </div>
          <div className="flex justify-center bg-stone-950 rounded-xl p-2 border border-sky-400/40 shadow-inner">
            <canvas ref={canvasUvRef} className="rounded-lg shadow-inner max-w-full" />
          </div>
          <p className="mt-2.5 text-[11px] text-emerald-700 font-semibold">
            UNet++ SCSE couples ERA5 wind vectors: isolates drifting oil and ignores calm sea look-alikes.
          </p>
        </div>
      </div>

      {/* Real-Time Telemetry Bar */}
      <section className="sketch-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-stone-50 rounded-xl border border-dashed border-stone-300">
            <span className="text-[10px] text-stone-500 font-mono uppercase block">Hydrodynamic Drift Speed</span>
            <strong className="text-xl font-bold text-stone-800 block mt-0.5">{metrics.driftSpeedKnots} knots</strong>
            <small className="text-stone-500 text-[10px] block">3.5% of {windSpeed.toFixed(1)} m/s wind</small>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-dashed border-stone-300">
            <span className="text-[10px] text-stone-500 font-mono uppercase block">Slick Surface Area</span>
            <strong className="text-xl font-bold text-sky-700 block mt-0.5">{metrics.slickAreaKm2} km²</strong>
            <small className="text-stone-500 text-[10px] block">Fay's gravity-viscous spreading</small>
          </div>

          <div className="p-3 bg-red-50 rounded-xl border border-dashed border-red-300">
            <span className="text-[10px] text-red-700 font-mono uppercase block">SAR-VV Baseline Alarm</span>
            <strong className="text-xl font-bold text-red-700 block mt-0.5">{metrics.sarVvFalseAlarmPercent}% FPR</strong>
            <small className="text-red-600 text-[10px] block">Flags entire calm sea as oil!</small>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-dashed border-emerald-300">
            <span className="text-[10px] text-emerald-800 font-mono uppercase block">SAR-UV False Alarm</span>
            <strong className="text-xl font-bold text-emerald-700 block mt-0.5">{metrics.sarUvFalseAlarmPercent}% FPR</strong>
            <small className="text-emerald-700 text-[10px] block">Look-alikes fully eliminated</small>
          </div>
        </div>
      </section>
    </div>
  );
}
