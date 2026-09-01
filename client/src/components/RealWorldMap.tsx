import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Compass,
  MapPin,
  Layers,
  Wind,
  ShieldAlert,
  Crosshair,
  Maximize2,
  Navigation,
  Globe2,
  Anchor
} from "lucide-react";

export interface SpillLocation {
  id: string;
  name: string;
  basin: string;
  lat: number;
  lng: number;
  depth: string;
  sourceType: string;
  incidentDate: string;
  windDefault: { speed: number; dir: number };
  nearestCoastKm: number;
  coastName: string;
  description: string;
}

export const realSpillSites: SpillLocation[] = [
  {
    id: "caspian",
    name: "Caspian Sea (Platform MC-20 Leak)",
    basin: "South Caspian Basin",
    lat: 40.3524,
    lng: 50.8211,
    depth: "82 m",
    sourceType: "Offshore Production Rig",
    incidentDate: "Nov 4, 2019",
    windDefault: { speed: 3.8, dir: 55 },
    nearestCoastKm: 28.4,
    coastName: "Absheron Peninsula, Azerbaijan",
    description: "Continuous drilling platform blowout inside an extensive Low-Wind-Speed Area (LWSA specular calm water).",
  },
  {
    id: "ionian",
    name: "Ionian Sea (Kefalonia Island Wake)",
    basin: "Central Mediterranean Sea",
    lat: 38.1822,
    lng: 20.4518,
    depth: "420 m",
    sourceType: "Commercial Tanker Discharge",
    incidentDate: "Jul 15, 2020",
    windDefault: { speed: 6.4, dir: 275 },
    nearestCoastKm: 12.1,
    coastName: "Kefalonia Leeward Coast, Greece",
    description: "Illegal bilge discharge trailing behind steep island topography (840m peak) producing dark leeward wakes.",
  },
  {
    id: "redsea",
    name: "Red Sea (Sabiti Tanker Collision)",
    basin: "Red Sea Shipping Channel",
    lat: 21.2541,
    lng: 38.9042,
    depth: "750 m",
    sourceType: "Suezmax Crude Tanker",
    incidentDate: "Oct 11, 2019",
    windDefault: { speed: 4.8, dir: 315 },
    nearestCoastKm: 94.0,
    coastName: "Jeddah Offshore Corridor, Saudi Arabia",
    description: "Twin parallel oil slicks trailing collided crude carrier across international maritime corridor.",
  },
  {
    id: "yellowsea",
    name: "Yellow Sea (Symphony Collision)",
    basin: "Yellow Sea Continental Shelf",
    lat: 35.8012,
    lng: 120.954,
    depth: "48 m",
    sourceType: "Bulk Carrier Collision",
    incidentDate: "Apr 27, 2021",
    windDefault: { speed: 5.2, dir: 140 },
    nearestCoastKm: 42.6,
    coastName: "Shandong Coast, Qingdao, China",
    description: "High-density bunker fuel spill verified via same-day Sentinel-2 optical imagery cross-checks.",
  },
  {
    id: "corsica",
    name: "Ligurian Sea (Ulysse / CSL Virginia)",
    basin: "Northwest Mediterranean",
    lat: 43.0984,
    lng: 9.6012,
    depth: "510 m",
    sourceType: "Container / Ro-Ro Collision",
    incidentDate: "Oct 7, 2018",
    windDefault: { speed: 2.4, dir: 15 },
    nearestCoastKm: 26.5,
    coastName: "Cap Corse Marine Sanctuary, France",
    description: "Multi-kilometer fuel oil slick spreading towards sensitive Mediterranean marine sanctuary.",
  },
  {
    id: "gulf_mexico",
    name: "Gulf of Mexico (Mississippi Canyon)",
    basin: "Northern Gulf of Mexico",
    lat: 28.7366,
    lng: -88.3659,
    depth: "1,520 m",
    sourceType: "Deepwater Wellhead",
    incidentDate: "Historical Benchmark",
    windDefault: { speed: 4.5, dir: 120 },
    nearestCoastKm: 66.0,
    coastName: "Louisiana Delta, United States",
    description: "Persistent natural hydrocarbon seeps and historical wellhead benchmark site.",
  },
];

interface RealWorldMapProps {
  currentWindSpeed?: number;
  currentWindDir?: number;
  onSelectSite?: (site: SpillLocation) => void;
  selectedSiteId?: string;
  showDriftPlume?: boolean;
}

export default function RealWorldMap({
  currentWindSpeed = 5.4,
  currentWindDir = 55,
  onSelectSite,
  selectedSiteId = "caspian",
  showDriftPlume = true,
}: RealWorldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const plumeLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeSite, setActiveSite] = useState<SpillLocation>(
    () => realSpillSites.find((s) => s.id === selectedSiteId) || realSpillSites[0]
  );
  const [basemap, setBasemap] = useState<"satellite" | "ocean" | "dark" | "osm">("satellite");
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Sync active site if parent props change
  useEffect(() => {
    const found = realSpillSites.find((s) => s.id === selectedSiteId);
    if (found && found.id !== activeSite.id) {
      setActiveSite(found);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([found.lat, found.lng], 10, { duration: 1.5 });
      }
    }
  }, [selectedSiteId]);

  // Robust Tile layer configurations (100% free, NO API keys needed, smooth auto-scaling up to zoom 19)
  const layerConfigs = {
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19,
      maxNativeZoom: 19,
      attribution: "Tiles &copy; Esri &mdash; World Imagery",
    },
    ocean: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19,
      maxNativeZoom: 9, // Auto-scales zoom 9 tiles smoothly when zoomed in past level 9, preventing 'Map data not yet available'
      attribution: "Tiles &copy; Esri &mdash; GEBCO, NOAA Bathymetry",
    },
    dark: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19,
      maxNativeZoom: 16, // Public Esri Canvas Dark (100% Free, NO API Key needed, no watermarks!)
      attribution: "Tiles &copy; Esri &mdash; Dark Gray Canvas",
    },
    osm: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxZoom: 19,
      maxNativeZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    },
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [activeSite.lat, activeSite.lng],
      zoom: 10,
      zoomControl: true,
      attributionControl: false,
    });

    const config = layerConfigs[basemap];
    const currentLayer = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      maxNativeZoom: config.maxNativeZoom,
      attribution: config.attribution,
    }).addTo(map);

    (map as any)._activeTileLayer = currentLayer;

    // Layer group for dynamic oil plumes and markers
    const plumeGroup = L.layerGroup().addTo(map);
    plumeLayerGroupRef.current = plumeGroup;

    // Track mouse coordinates
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      setCursorCoords({
        lat: parseFloat(e.latlng.lat.toFixed(5)),
        lng: parseFloat(e.latlng.lng.toFixed(5)),
      });
    });

    map.on("mouseout", () => {
      setCursorCoords(null);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Tile Layer when basemap changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if ((map as any)._activeTileLayer) {
      map.removeLayer((map as any)._activeTileLayer);
    }

    const config = layerConfigs[basemap];
    const newLayer = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      maxNativeZoom: config.maxNativeZoom,
      attribution: config.attribution,
    }).addTo(map);

    (map as any)._activeTileLayer = newLayer;
  }, [basemap]);

  // Render Markers, Plumes & Wind Trajectory whenever location or wind changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = plumeLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Add All Benchmark Site Markers
    realSpillSites.forEach((site) => {
      const isSelected = site.id === activeSite.id;

      // Custom pulsing HTML marker
      const markerHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="
            width: ${isSelected ? "22px" : "14px"};
            height: ${isSelected ? "22px" : "14px"};
            border-radius: 50%;
            background: ${isSelected ? "#ef4444" : "#38bdf8"};
            border: 2px solid #ffffff;
            box-shadow: 0 0 12px ${isSelected ? "rgba(239,68,68,0.9)" : "rgba(56,189,248,0.6)"};
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${isSelected ? '<div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>' : ""}
          </div>
          ${
            isSelected
              ? `<div style="
                  position: absolute;
                  width: 38px;
                  height: 38px;
                  border-radius: 50%;
                  border: 2px dashed #ef4444;
                  animation: spin 8s linear infinite;
                "></div>`
              : ""
          }
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-spill-pin",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([site.lat, site.lng], { icon: customIcon }).addTo(group);

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; color: #1e293b; min-width: 180px;">
          <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 3px;">${site.name}</strong>
          <span style="display: block; color: #64748b; margin-bottom: 6px;">${site.basin}</span>
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 5px; font-family: monospace; font-size: 11px;">
            <strong>Coords:</strong> ${site.lat.toFixed(4)}° N, ${site.lng.toFixed(4)}° E<br/>
            <strong>Water Depth:</strong> ${site.depth}<br/>
            <strong>Distance to Coast:</strong> ${site.nearestCoastKm} km
          </div>
        </div>
      `);

      marker.on("click", () => {
        handleSelectSite(site);
      });
    });

    // 2. Render Dynamic Oil Drift Plume & Wind Vector on Active Site
    if (showDriftPlume && activeSite) {
      const lat = activeSite.lat;
      const lng = activeSite.lng;

      // Mathematical plume advection
      const rad = (currentWindDir * Math.PI) / 180;
      const u = Math.cos(rad);
      const v = Math.sin(rad);

      // Distance factor proportional to wind speed (degrees on map)
      const plumeLengthDeg = 0.04 + (currentWindSpeed / 10.0) * 0.08;
      const plumeWidthDeg = 0.02 + (currentWindSpeed / 10.0) * 0.035;

      const endLat = lat + v * plumeLengthDeg;
      const endLng = lng + (u * plumeLengthDeg) / Math.cos((lat * Math.PI) / 180);

      // Perpendicular vector for plume fanning
      const perpLat = -u * plumeWidthDeg;
      const perpLng = (v * plumeWidthDeg) / Math.cos((lat * Math.PI) / 180);

      // Polygon points representing viscous expanding oil plume
      const plumePolygonPoints: [number, number][] = [
        [lat, lng], // Leak origin
        [lat + v * (plumeLengthDeg * 0.3) + perpLat * 0.4, lng + (u * (plumeLengthDeg * 0.3)) / Math.cos((lat * Math.PI) / 180) + perpLng * 0.4],
        [endLat + perpLat, endLng + perpLng],
        [endLat + v * 0.01, endLng + (u * 0.01) / Math.cos((lat * Math.PI) / 180)], // Plume apex
        [endLat - perpLat, endLng - perpLng],
        [lat + v * (plumeLengthDeg * 0.3) - perpLat * 0.4, lng + (u * (plumeLengthDeg * 0.3)) / Math.cos((lat * Math.PI) / 180) - perpLng * 0.4],
      ];

      // Plume outline (black hydrocarbon slick)
      L.polygon(plumePolygonPoints, {
        color: "#020408",
        weight: 2,
        fillColor: "#050811",
        fillOpacity: 0.85,
      }).addTo(group);

      // Inner dense core
      L.polygon(
        [
          [lat, lng],
          [lat + v * (plumeLengthDeg * 0.5) + perpLat * 0.3, lng + (u * (plumeLengthDeg * 0.5)) / Math.cos((lat * Math.PI) / 180) + perpLng * 0.3],
          [lat + v * (plumeLengthDeg * 0.8), lng + (u * (plumeLengthDeg * 0.8)) / Math.cos((lat * Math.PI) / 180)],
          [lat + v * (plumeLengthDeg * 0.5) - perpLat * 0.3, lng + (u * (plumeLengthDeg * 0.5)) / Math.cos((lat * Math.PI) / 180) - perpLng * 0.3],
        ],
        {
          color: "#000000",
          weight: 1,
          fillColor: "#000000",
          fillOpacity: 0.95,
        }
      ).addTo(group);

      // Wind Vector Arrow (Direction & Velocity)
      const arrowLength = 0.05 + (currentWindSpeed / 12.0) * 0.06;
      const arrowEndLat = lat + v * arrowLength;
      const arrowEndLng = lng + (u * arrowLength) / Math.cos((lat * Math.PI) / 180);

      L.polyline([[lat, lng], [arrowEndLat, arrowEndLng]], {
        color: "#38bdf8",
        weight: 3,
        dashArray: "4, 4",
      }).addTo(group);

      // 10km Safety & Boom Containment Buffer
      L.circle([lat, lng], {
        radius: 6000,
        color: "#ef4444",
        weight: 1.5,
        fillOpacity: 0.05,
        dashArray: "6, 6",
      }).addTo(group);
    }
  }, [activeSite, currentWindSpeed, currentWindDir, showDriftPlume]);

  const handleSelectSite = (site: SpillLocation) => {
    setActiveSite(site);
    if (onSelectSite) {
      onSelectSite(site);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([site.lat, site.lng], 11, { duration: 1.5 });
    }
  };

  // Format DMS
  const formatDms = (val: number, isLat: boolean) => {
    const dir = isLat ? (val >= 0 ? "N" : "S") : val >= 0 ? "E" : "W";
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const min = Math.floor((abs - deg) * 60);
    const sec = Math.round(((abs - deg) * 60 - min) * 60);
    return `${deg}° ${min}' ${sec}" ${dir}`;
  };

  return (
    <div className="sketch-card p-4 overflow-hidden relative">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-sky-100 text-sky-700">
              <Globe2 size={16} />
            </span>
            <h3 className="font-bold text-sm text-stone-800">
              Real-World Satellite &amp; GIS Spill Locator
            </h3>
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Pinpoint exact geographical coordinates, ocean bathymetry, and shoreline drift trajectory.
          </p>
        </div>

        {/* Basemap Switcher */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-300 text-xs font-mono">
          <button
            onClick={() => setBasemap("satellite")}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              basemap === "satellite" ? "bg-stone-800 text-white shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Satellite Photo
          </button>
          <button
            onClick={() => setBasemap("ocean")}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              basemap === "ocean" ? "bg-stone-800 text-white shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Ocean Bathymetry
          </button>
          <button
            onClick={() => setBasemap("dark")}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              basemap === "dark" ? "bg-stone-800 text-white shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Radar Dark
          </button>
          <button
            onClick={() => setBasemap("osm")}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              basemap === "osm" ? "bg-stone-800 text-white shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Nautical OSM
          </button>
        </div>
      </div>

      {/* Quick Ocean Basin Selector Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-thin">
        <span className="text-[10px] font-mono text-stone-500 uppercase font-semibold shrink-0">
          Fly To Incident Site:
        </span>
        {realSpillSites.map((site) => (
          <button
            key={site.id}
            onClick={() => handleSelectSite(site)}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-all flex items-center gap-1 font-semibold ${
              activeSite.id === site.id
                ? "bg-rose-600 text-white shadow-sm scale-105"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300"
            }`}
          >
            <MapPin size={12} />
            {site.name.split(" ")[0]} ({site.basin.split(" ")[0]})
          </button>
        ))}
      </div>

      {/* Main Map Container */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-stone-800 shadow-md">
        <div
          ref={mapContainerRef}
          style={{ height: "420px", width: "100%", zIndex: 1 }}
          className="bg-stone-900"
        />

        {/* Live GPS Telemetry Overlay Box */}
        <div
          style={{ zIndex: 1000 }}
          className="absolute top-3 left-3 bg-stone-900/90 backdrop-blur-md text-white p-3 rounded-xl border border-stone-700 shadow-lg max-w-xs pointer-events-none"
        >
          <div className="flex items-center gap-1.5 text-rose-400 font-mono text-xs font-bold mb-1">
            <Anchor size={14} />
            <span>INCIDENT EPICENTER SPOT</span>
          </div>
          <strong className="text-sm block text-stone-100 font-bold leading-tight">
            {activeSite.name}
          </strong>
          <span className="text-[11px] text-stone-400 block mb-2">{activeSite.basin}</span>

          <div className="space-y-1 font-mono text-[11px] border-t border-stone-800 pt-2 text-stone-300">
            <div className="flex justify-between">
              <span className="text-stone-400">Decimal GPS:</span>
              <span className="text-sky-400 font-bold">
                {activeSite.lat.toFixed(5)}°, {activeSite.lng.toFixed(5)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">DMS Notation:</span>
              <span className="text-stone-300">{formatDms(activeSite.lat, true)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Water Depth:</span>
              <span className="text-emerald-400 font-bold">{activeSite.depth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Coast Distance:</span>
              <span className="text-amber-400 font-bold">{activeSite.nearestCoastKm} km</span>
            </div>
            <div className="text-[10px] text-stone-400 pt-1 leading-snug">
              Coastline: {activeSite.coastName}
            </div>
          </div>
        </div>

        {/* Live Cursor Coordinate HUD (Bottom-Right) */}
        <div
          style={{ zIndex: 1000 }}
          className="absolute bottom-3 right-3 bg-stone-950/80 backdrop-blur text-stone-300 px-3 py-1.5 rounded-lg border border-stone-700 text-xs font-mono pointer-events-none flex items-center gap-2"
        >
          <Crosshair size={13} className="text-sky-400" />
          {cursorCoords ? (
            <span>
              Lat: <strong>{cursorCoords.lat.toFixed(4)}°</strong> · Lng:{" "}
              <strong>{cursorCoords.lng.toFixed(4)}°</strong>
            </span>
          ) : (
            <span>Hover map to inspect GPS coordinates</span>
          )}
        </div>

        {/* Legend Overlay (Bottom-Left) */}
        <div
          style={{ zIndex: 1000 }}
          className="absolute bottom-3 left-3 bg-stone-900/90 backdrop-blur p-2 rounded-lg border border-stone-700 text-[10px] font-mono text-stone-300 pointer-events-none flex items-center gap-3"
        >
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block border border-white" />
            Wellhead Source
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 bg-stone-950 inline-block border border-stone-600" />
            Drifting Hydrocarbon Plume
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-sky-400 inline-block" />
            Wind Vector ({currentWindSpeed.toFixed(1)} m/s @ {currentWindDir}°)
          </span>
        </div>
      </div>
    </div>
  );
}
