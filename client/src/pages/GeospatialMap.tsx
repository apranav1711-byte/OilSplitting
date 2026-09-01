import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import RealWorldMap, { realSpillSites, SpillLocation } from "@/components/RealWorldMap";
import { Globe2, Navigation, AlertTriangle, Ship, Anchor, Compass } from "lucide-react";

export default function GeospatialMap() {
  const [selectedSite, setSelectedSite] = useState<SpillLocation>(realSpillSites[0]);

  return (
    <div className="screen-shell">
      <ScreenHeader
        eyebrow="Global Geographic Information System (GIS)"
        title="Real-World Satellite Spill Locator"
      />

      <section className="hand-note note-blue">
        <span>Global Satellite GIS</span>
        <strong>Interactive Multi-Basin Spill Mapping &amp; Shoreline Vulnerability</strong>
        <small>Accurate geographic coordinates, nautical basemaps, water depth, and distance-to-coast calculations across all 17 documented global spill locations</small>
      </section>

      {/* Main Map Component */}
      <RealWorldMap
        selectedSiteId={selectedSite.id}
        currentWindSpeed={selectedSite.windDefault.speed}
        currentWindDir={selectedSite.windDefault.dir}
        onSelectSite={(site) => setSelectedSite(site)}
      />

      {/* Selected Location Operational Briefing Card */}
      <div className="sketch-card p-5 mt-6">
        <div className="card-heading mb-3">
          <div>
            <p className="eyebrow">Active Incident Operational Briefing</p>
            <h2>{selectedSite.name}</h2>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
            {selectedSite.sourceType}
          </span>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed mb-4">
          {selectedSite.description}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-dashed border-stone-300">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] text-stone-500 font-mono uppercase block">Precise Coordinates</span>
            <strong className="text-sm font-mono text-sky-700 block mt-1">
              {selectedSite.lat.toFixed(4)}° N, {selectedSite.lng.toFixed(4)}° E
            </strong>
            <small className="text-stone-500 text-[10px]">WGS 84 Geodetic Datum</small>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] text-stone-500 font-mono uppercase block">Bathymetric Depth</span>
            <strong className="text-sm font-mono text-emerald-700 block mt-1">
              {selectedSite.depth}
            </strong>
            <small className="text-stone-500 text-[10px]">GEBCO Bathymetry</small>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] text-stone-500 font-mono uppercase block">Vulnerable Shoreline</span>
            <strong className="text-sm font-mono text-amber-700 block mt-1">
              {selectedSite.nearestCoastKm} km
            </strong>
            <small className="text-stone-500 text-[10px] truncate block">{selectedSite.coastName}</small>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] text-stone-500 font-mono uppercase block">Sentinel-1 Overpass</span>
            <strong className="text-sm font-mono text-stone-800 block mt-1">
              {selectedSite.incidentDate}
            </strong>
            <small className="text-stone-500 text-[10px]">Copernicus Archive</small>
          </div>
        </div>
      </div>
    </div>
  );
}
