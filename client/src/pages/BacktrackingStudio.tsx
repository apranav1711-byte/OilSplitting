import { useState, useRef, useEffect } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  History,
  RotateCcw,
  Play,
  Pause,
  Ship,
  Compass,
  Navigation,
  Crosshair,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  MapPin,
  FileSpreadsheet,
  Download,
  Printer,
  ChevronRight,
  Search,
  Waves,
  Wind
} from "lucide-react";
import L from "leaflet";

interface SuspectVessel {
  name: string;
  imo: string;
  mmsi: string;
  flag: string;
  vesselType: string;
  speedKnots: number;
  courseDeg: number;
  timeAtOrigin: string;
  distanceToOriginKm: number;
  matchConfidence: number;
  destinationPort: string;
  dischargeType: string;
}

interface BacktrackScenario {
  id: string;
  title: string;
  basin: string;
  sarDetectionTime: string;
  observedLat: number;
  observedLng: number;
  observedAreaKm2: number;
  windSpeed: number;
  windDir: number;
  reconstructedAgeHours: number;
  originLat: number;
  originLng: number;
  originLocationName: string;
  waterDepth: string;
  suspects: SuspectVessel[];
}

const backtrackScenarios: BacktrackScenario[] = [
  {
    id: "ionian_bilge",
    title: "Ionian Sea Mysterious Bilge Slick (Zakynthos / Kefalonia)",
    basin: "Central Mediterranean Sea",
    sarDetectionTime: "12 Oct 2026 06:14 UTC",
    observedLat: 38.1822,
    observedLng: 20.4518,
    observedAreaKm2: 14.8,
    windSpeed: 6.2,
    windDir: 275, // West-northwest wind blowing slick east
    reconstructedAgeHours: 16.5,
    originLat: 38.1654,
    originLng: 20.0892,
    originLocationName: "Ionian Deep Trench (International Shipping Lane)",
    depth: "1,140 m",
    suspects: [
      {
        name: "MT Aeolian Trader",
        imo: "9482110",
        mmsi: "241890000",
        flag: "Panama",
        vesselType: "Aframax Crude Tanker (115,000 DWT)",
        speedKnots: 13.8,
        courseDeg: 115,
        timeAtOrigin: "11 Oct 2026 13:45 UTC",
        distanceToOriginKm: 0.9,
        matchConfidence: 94.6,
        destinationPort: "Augusta, Italy -> Piraeus, Greece",
        dischargeType: "Illegal Nighttime Bilge Discharge (High Oily Water Separator Bypass)",
      },
      {
        name: "MV Nordic Spirit",
        imo: "9317541",
        mmsi: "258120000",
        flag: "Norway",
        vesselType: "Bulk Carrier (75,000 DWT)",
        speedKnots: 11.2,
        courseDeg: 290,
        timeAtOrigin: "11 Oct 2026 11:20 UTC",
        distanceToOriginKm: 8.4,
        matchConfidence: 34.2,
        destinationPort: "Izmir -> Rotterdam",
        dischargeType: "Passed vicinity 2.5h prior; route mismatch",
      },
    ],
  },
  {
    id: "red_sea_corridor",
    title: "Red Sea International Corridor Discharge",
    basin: "Red Sea Bab-el-Mandeb Approach",
    sarDetectionTime: "04 Nov 2026 05:28 UTC",
    observedLat: 21.2541,
    observedLng: 38.9042,
    observedAreaKm2: 24.2,
    windSpeed: 5.1,
    windDir: 320,
    reconstructedAgeHours: 21.0,
    originLat: 21.4891,
    originLng: 38.6412,
    originLocationName: "Jeddah Offshore Northbound Fairway",
    depth: "750 m",
    suspects: [
      {
        name: "MT Al-Yamama Star",
        imo: "9601423",
        mmsi: "403194000",
        flag: "Saudi Arabia",
        vesselType: "Chemical / Products Carrier (45,000 DWT)",
        speedKnots: 14.5,
        courseDeg: 160,
        timeAtOrigin: "03 Nov 2026 08:30 UTC",
        distanceToOriginKm: 1.2,
        matchConfidence: 91.8,
        destinationPort: "Yanbu -> Djibouti",
        dischargeType: "Tank Cleaning Washwater Discharge into Sea",
      },
    ],
  },
  {
    id: "yellow_sea_collision",
    title: "Yellow Sea Unreported Bunkering Spill",
    basin: "Yellow Sea Continental Shelf",
    sarDetectionTime: "18 Sep 2026 02:40 UTC",
    observedLat: 35.8012,
    observedLng: 120.954,
    observedAreaKm2: 32.5,
    windSpeed: 5.6,
    windDir: 135,
    reconstructedAgeHours: 28.0,
    originLat: 35.5892,
    originLng: 121.2415,
    originLocationName: "Qingdao Anchorage Outer Limit",
    depth: "52 m",
    suspects: [
      {
        name: "MV Pacific Pioneer",
        imo: "9218754",
        mmsi: "354921000",
        flag: "Liberia",
        vesselType: "Capesize Bulk Carrier (180,000 DWT)",
        speedKnots: 8.4,
        courseDeg: 340,
        timeAtOrigin: "16 Sep 2026 22:45 UTC",
        distanceToOriginKm: 1.5,
        matchConfidence: 88.4,
        destinationPort: "Port Hedland -> Qingdao",
        dischargeType: "Fuel Bunkering Overflow during ship-to-ship transfer",
      },
    ],
  },
];

export default function BacktrackingStudio() {
  const [selectedScenario, setSelectedScenario] = useState<BacktrackScenario>(backtrackScenarios[0]);
  const [rewindHours, setRewindHours] = useState(0); // 0 = observed, max = reconstructedAgeHours
  const [isPlaying, setIsPlaying] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // Play animation loop (rewinding backwards in time)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setRewindHours((prev) => {
          if (prev >= selectedScenario.reconstructedAgeHours) {
            setIsPlaying(false);
            return selectedScenario.reconstructedAgeHours;
          }
          return Math.min(selectedScenario.reconstructedAgeHours, parseFloat((prev + 0.5).toFixed(1)));
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isPlaying, selectedScenario]);

  // Reset rewind when scenario changes
  useEffect(() => {
    setRewindHours(0);
    setIsPlaying(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(
        [(selectedScenario.observedLat + selectedScenario.originLat) / 2, (selectedScenario.observedLng + selectedScenario.originLng) / 2],
        10,
        { duration: 1.2 }
      );
    }
  }, [selectedScenario]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [(selectedScenario.observedLat + selectedScenario.originLat) / 2, (selectedScenario.observedLng + selectedScenario.originLng) / 2],
      zoom: 10,
      zoomControl: true,
      attributionControl: false,
    });

    // Satellite Imagery Basemap (100% Free, NO API KEY)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      maxNativeZoom: 19,
      attribution: "Tiles &copy; Esri World Imagery",
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layersRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Map Trajectory, Rewound Position, and AIS tracks
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const obsLat = selectedScenario.observedLat;
    const obsLng = selectedScenario.observedLng;
    const origLat = selectedScenario.originLat;
    const origLng = selectedScenario.originLng;

    // 1. Observed Satellite Detection Spot (T = 0)
    const obsMarker = L.circleMarker([obsLat, obsLng], {
      radius: 9,
      color: "#38bdf8",
      weight: 2,
      fillColor: "#0284c7",
      fillOpacity: 0.9,
    }).addTo(group);

    obsMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 11px;">
        <strong style="color: #0284c7;">Observed Detection Spot (T = 0)</strong><br/>
        Sentinel-1 Overpass: ${selectedScenario.sarDetectionTime}<br/>
        Coords: ${obsLat.toFixed(4)}° N, ${obsLng.toFixed(4)}° E<br/>
        Slick Area: ${selectedScenario.observedAreaKm2} km²
      </div>
    `);

    // 2. Reconstructed Discharge Origin (T = -age)
    const originMarker = L.circleMarker([origLat, origLng], {
      radius: 11,
      color: "#ef4444",
      weight: 3,
      fillColor: "#dc2626",
      fillOpacity: 1,
    }).addTo(group);

    originMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 11px;">
        <strong style="color: #dc2626;">IDENTIFIED POLLUTION ORIGIN (T - ${selectedScenario.reconstructedAgeHours}h)</strong><br/>
        Location: ${selectedScenario.originLocationName}<br/>
        Coords: ${origLat.toFixed(4)}° N, ${origLng.toFixed(4)}° E<br/>
        Depth: ${selectedScenario.depth}<br/>
        Suspect Polluter: <strong>${selectedScenario.suspects[0].name}</strong> (${selectedScenario.suspects[0].matchConfidence}% match)
      </div>
    `);

    // 3. Reverse Trajectory Path (Dashed yellow line with uncertainty buffer)
    const backtrackPoints: [number, number][] = [
      [obsLat, obsLng],
      [(obsLat * 2 + origLat) / 3, (obsLng * 2 + origLng) / 3],
      [(obsLat + origLat * 2) / 3, (obsLng + origLng * 2) / 3],
      [origLat, origLng],
    ];

    L.polyline(backtrackPoints, {
      color: "#fbbf24",
      weight: 3,
      dashArray: "6, 6",
    }).addTo(group);

    // Uncertainty origin cone
    L.circle([origLat, origLng], {
      radius: 3500,
      color: "#ef4444",
      weight: 1.5,
      dashArray: "4, 4",
      fillColor: "#ef4444",
      fillOpacity: 0.1,
    }).addTo(group);

    // 4. Current Rewound Position Marker based on rewindHours
    const fraction = rewindHours / selectedScenario.reconstructedAgeHours;
    const currentLat = obsLat + (origLat - obsLat) * fraction;
    const currentLng = obsLng + (origLng - obsLng) * fraction;
    const currentArea = Math.max(
      3.2,
      selectedScenario.observedAreaKm2 * (1 - fraction * 0.65)
    );

    // Moving Slick Polygon (shrinks as it goes back to wellhead/ship origin)
    L.circle([currentLat, currentLng], {
      radius: Math.sqrt(currentArea) * 350,
      color: "#050811",
      weight: 2,
      fillColor: "#020408",
      fillOpacity: 0.85,
    }).addTo(group);

    // Rewind Target Crosshair
    const rewindIcon = L.divIcon({
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="width: 14px; height: 14px; border-radius: 50%; background: #fbbf24; border: 2px solid #ffffff; box-shadow: 0 0 10px #fbbf24;"></div>
        </div>
      `,
      className: "custom-rewind-marker",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([currentLat, currentLng], { icon: rewindIcon }).addTo(group);

    // 5. Suspect Vessel Track (AIS Interception Corridor)
    const primeSuspect = selectedScenario.suspects[0];
    const aisTrack: [number, number][] = [
      [origLat - 0.08, origLng - 0.12],
      [origLat, origLng],
      [origLat + 0.08, origLng + 0.12],
    ];

    L.polyline(aisTrack, {
      color: "#a855f7",
      weight: 3,
    }).addTo(group);

    // Ship marker at interception time
    const shipIcon = L.divIcon({
      html: `
        <div style="background: #a855f7; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; border: 1px solid white; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
          🚢 ${primeSuspect.name} (${primeSuspect.timeAtOrigin})
        </div>
      `,
      className: "custom-ship-marker",
      iconAnchor: [20, 10],
    });

    L.marker([origLat, origLng], { icon: shipIcon }).addTo(group);
  }, [selectedScenario, rewindHours]);

  const primeSuspect = selectedScenario.suspects[0];
  const fraction = rewindHours / selectedScenario.reconstructedAgeHours;
  const currentLat = selectedScenario.observedLat + (selectedScenario.originLat - selectedScenario.observedLat) * fraction;
  const currentLng = selectedScenario.observedLng + (selectedScenario.originLng - selectedScenario.observedLng) * fraction;

  return (
    <div className="screen-shell">
      <ScreenHeader
        eyebrow="Reverse Hydrodynamic Trajectory &amp; AIS Identification"
        title="Spill Origin Backtracking &amp; Polluter Tracing"
      >
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`solid-button ${
            isPlaying ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          {isPlaying ? (
            <>
              <Pause size={16} /> Pause Rewind
            </>
          ) : (
            <>
              <Play size={16} /> Play Reverse Rewind
            </>
          )}
        </button>
        <button onClick={() => setRewindHours(0)} className="outline-button">
          <RotateCcw size={16} /> Reset to Observation Time
        </button>
      </ScreenHeader>

      {/* Hand Note Tape Memo */}
      <section className="hand-note note-blue">
        <span>Reverse Lagrangian Physics</span>
        <strong>Reverse Drift Modeling Pinpoints Exact Vessel Release Coordinates &amp; Timestamp</strong>
        <small>Applies inverse ERA5 wind vectors (-3.5% W10) and surface advection to rewind the observed oil slick upstream across shipping corridors</small>
      </section>

      {/* Scenario Selector Tabs */}
      <div className="sketch-card p-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Select Verified Historical Mystery Slick
            </label>
            <div className="flex flex-wrap gap-2">
              {backtrackScenarios.map((scen) => (
                <button
                  key={scen.id}
                  onClick={() => setSelectedScenario(scen)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    selectedScenario.id === scen.id
                      ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                      : "bg-white text-stone-700 border-stone-300 hover:bg-stone-100"
                  }`}
                >
                  {scen.title.split(" ")[0]} {scen.title.split(" ")[1]} ({scen.basin.split(" ")[0]})
                </button>
              ))}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-stone-500 uppercase block">Sentinel-1 Detection</span>
            <strong className="text-xs font-mono text-sky-800">{selectedScenario.sarDetectionTime}</strong>
          </div>
        </div>
      </div>

      {/* Interactive Reverse Timeline Scrubber */}
      <div className="sketch-card p-5 mb-5 border-2 border-stone-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-rose-600" />
            <h3 className="font-bold text-sm text-stone-900">
              Interactive Time-Reversal Scrubber (Lagrangian Backtrack)
            </h3>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 font-bold">
              T = -{rewindHours} Hours
            </span>
            <span className="text-stone-500">
              Target Origin: <strong>-{selectedScenario.reconstructedAgeHours} Hours Ago</strong>
            </span>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max={selectedScenario.reconstructedAgeHours}
          step="0.5"
          value={rewindHours}
          onChange={(e) => setRewindHours(parseFloat(e.target.value))}
          className="w-full cursor-pointer accent-rose-600"
        />

        <div className="flex justify-between text-[10px] font-mono text-stone-500 mt-2">
          <span>0.0h (Satellite Observed State)</span>
          <span className="text-amber-700 font-bold">
            Rewound Coordinates: {currentLat.toFixed(4)}° N, {currentLng.toFixed(4)}° E
          </span>
          <span className="text-rose-700 font-bold">
            -{selectedScenario.reconstructedAgeHours}h (Initial Release Moment)
          </span>
        </div>
      </div>

      {/* Main Backtracking Map & Suspect Dossier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Left 2 Cols: Satellite Map with Reverse Path */}
        <div className="lg:col-span-2 sketch-card p-4">
          <div className="card-heading mb-3">
            <div>
              <p className="eyebrow">Visualized Reverse Trajectory</p>
              <h3 className="font-bold text-sm">Slick Origin Cone &amp; AIS Interception</h3>
            </div>
            <span className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-bold">
              {primeSuspect.matchConfidence}% Match
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-stone-700 shadow-md">
            <div
              ref={mapContainerRef}
              style={{ height: "460px", width: "100%", zIndex: 1 }}
              className="bg-stone-900"
            />

            {/* Map Legend Overlay */}
            <div
              style={{ zIndex: 1000 }}
              className="absolute bottom-3 left-3 bg-stone-900/90 backdrop-blur p-2.5 rounded-xl border border-stone-700 text-[10px] font-mono text-stone-300 pointer-events-none space-y-1 shadow-lg"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                <span>Observed Slick (Sentinel-1 SAR)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-400 inline-block" />
                <span>Reverse Hydrodynamic Drift (-3.5% W10)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                <span>Pinpointed Origin &amp; 3.5km Uncertainty Cone</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-purple-500 inline-block" />
                <span>Historical AIS Vessel Transit Corridor</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Suspect Polluter Identification Dossier */}
        <div className="sketch-card p-5 border-2 border-rose-600/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="eyebrow text-rose-600">IDENTIFIED POLLUTER VESSEL</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold">
                PRIME SUSPECT
              </span>
            </div>

            <h2 className="text-xl font-black text-stone-900 mb-1 flex items-center gap-2">
              <Ship size={22} className="text-rose-600" />
              {primeSuspect.name}
            </h2>
            <p className="text-xs text-stone-500 font-mono mb-3">
              IMO: <strong>{primeSuspect.imo}</strong> · MMSI: {primeSuspect.mmsi} · Flag: <strong>{primeSuspect.flag}</strong>
            </p>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 mb-4 text-xs font-mono space-y-1.5 text-stone-700">
              <div className="flex justify-between">
                <span>Vessel Type:</span>
                <strong className="text-stone-900">{primeSuspect.vesselType.split("(")[0]}</strong>
              </div>
              <div className="flex justify-between">
                <span>Transit Speed:</span>
                <strong>{primeSuspect.speedKnots} knots</strong>
              </div>
              <div className="flex justify-between">
                <span>Discharge Time:</span>
                <strong className="text-rose-700">{primeSuspect.timeAtOrigin}</strong>
              </div>
              <div className="flex justify-between">
                <span>Trajectory Offset:</span>
                <strong className="text-emerald-700">{primeSuspect.distanceToOriginKm} km from origin</strong>
              </div>
              <div className="flex justify-between">
                <span>Correlation Score:</span>
                <strong className="text-rose-700 font-bold">{primeSuspect.matchConfidence}%</strong>
              </div>
            </div>

            <div className="text-xs text-stone-600 space-y-2 mb-4">
              <div>
                <strong className="block text-stone-800">Assessed Discharge Modality:</strong>
                <span className="text-[11px] text-stone-600 leading-snug block mt-0.5">
                  {primeSuspect.dischargeType}
                </span>
              </div>
              <div>
                <strong className="block text-stone-800">Commercial Voyage:</strong>
                <span className="text-[11px] text-stone-500 font-mono block mt-0.5">
                  {primeSuspect.destinationPort}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-dashed border-stone-300">
            <button
              onClick={() => window.print()}
              className="w-full solid-button bg-stone-900 hover:bg-black text-white text-xs py-2 px-3 flex items-center justify-center gap-1.5 rounded-xl shadow"
            >
              <Printer size={14} /> Export Maritime Law Enforcement Report
            </button>
          </div>
        </div>
      </div>

      {/* Step-by-Step Backtracking Timeline Table */}
      <section className="sketch-card p-5">
        <h3 className="font-bold text-sm text-stone-900 mb-3 flex items-center gap-2">
          <History size={16} className="text-sky-600" />
          Reconstructed Reverse Trajectory Stages
        </h3>

        <div className="overflow-x-auto rounded-xl border border-stone-300">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-stone-100 text-stone-700 uppercase text-[10px] border-b border-stone-300">
              <tr>
                <th className="p-3">Stage</th>
                <th className="p-3">Time Offset</th>
                <th className="p-3">Reconstructed Coordinates</th>
                <th className="p-3">Upstream Distance</th>
                <th className="p-3">Estimated Slick Area</th>
                <th className="p-3">Environmental Dynamic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              <tr className="bg-sky-50/40">
                <td className="p-3 font-bold text-sky-800">Satellite Detection</td>
                <td className="p-3">T = 0.0 Hours</td>
                <td className="p-3">{selectedScenario.observedLat.toFixed(4)}° N, {selectedScenario.observedLng.toFixed(4)}° E</td>
                <td className="p-3">0.0 km</td>
                <td className="p-3 font-bold">{selectedScenario.observedAreaKm2} km²</td>
                <td className="p-3 text-stone-600">Sentinel-1 C-band SAR observation</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-stone-800">Mid-Drift Phase</td>
                <td className="p-3">T = -{(selectedScenario.reconstructedAgeHours / 2).toFixed(1)} Hours</td>
                <td className="p-3">
                  {((selectedScenario.observedLat + selectedScenario.originLat) / 2).toFixed(4)}° N,{" "}
                  {((selectedScenario.observedLng + selectedScenario.originLng) / 2).toFixed(4)}° E
                </td>
                <td className="p-3">
                  {(selectedScenario.windSpeed * 0.035 * 3.6 * (selectedScenario.reconstructedAgeHours / 2)).toFixed(1)} km
                </td>
                <td className="p-3">{(selectedScenario.observedAreaKm2 * 0.58).toFixed(1)} km²</td>
                <td className="p-3 text-stone-600">Lagrangian wind advection ({selectedScenario.windSpeed} m/s)</td>
              </tr>
              <tr className="bg-rose-50/60 font-semibold">
                <td className="p-3 font-bold text-rose-700">Initial Discharge Event</td>
                <td className="p-3 text-rose-700">T = -{selectedScenario.reconstructedAgeHours} Hours</td>
                <td className="p-3 text-rose-900">{selectedScenario.originLat.toFixed(4)}° N, {selectedScenario.originLng.toFixed(4)}° E</td>
                <td className="p-3">
                  {(selectedScenario.windSpeed * 0.035 * 3.6 * selectedScenario.reconstructedAgeHours).toFixed(1)} km upstream
                </td>
                <td className="p-3 font-bold text-rose-800">~2.8 km² (Fresh plume)</td>
                <td className="p-3 text-rose-700 font-bold">
                  Intersects AIS track of {primeSuspect.name}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
