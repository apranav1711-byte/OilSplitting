import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { historicalSpills } from "@/lib/demoData";
import { Search, Globe2, FileText, CheckCircle2 } from "lucide-react";

export default function AuditLog() {
  const [search, setSearch] = useState("");

  const filtered = historicalSpills.filter(
    (s) =>
      s.region.toLowerCase().includes(search.toLowerCase()) ||
      s.source.toLowerCase().includes(search.toLowerCase()) ||
      s.spillType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="screen-shell">
      <ScreenHeader
        eyebrow="Table I &amp; IV: Global Validation Dataset"
        title="Historical Spill Incidents &amp; Audit Log"
      />

      <section className="hand-note note-blue">
        <span>Global Traceability</span>
        <strong>17 Documented Incident Basins across World Oceans</strong>
        <small>Strict ground truth validation backed by official institutional reports, NOAA OSPO, and same-day Sentinel-2 optical cross-checks</small>
      </section>

      {/* Audit Tools Strip (from chargeBackShield) */}
      <div className="audit-tools">
        <div className="search-field">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by ocean basin, vessel, or spill type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="mono text-xs text-stone-500">
          Showing {filtered.length} of {historicalSpills.length} Documented Events
        </span>
      </div>

      {/* Audit Table Card */}
      <div className="sketch-card audit-table-card">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Incident Tag</th>
              <th>Geographic Region</th>
              <th>Accident Date</th>
              <th>Spill Category</th>
              <th>Look-Alike Hazard</th>
              <th>SAR-VV F1</th>
              <th>SAR-UV F1</th>
              <th>Validation Evidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="audit-action mono font-bold">{item.id}</span>
                  <span className="entity-id block mt-0.5">{item.coordinates}</span>
                </td>
                <td>
                  <strong>{item.region}</strong>
                  <div className="text-[11px] text-stone-500">{item.source}</div>
                </td>
                <td className="mono text-xs">{item.date}</td>
                <td>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-800 border border-stone-200">
                    {item.spillType}
                  </span>
                </td>
                <td>
                  <span className="text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {item.lookAlikeCondition}
                  </span>
                </td>
                <td className="mono text-xs text-red-600 font-bold">{item.f1VV}%</td>
                <td className="mono text-xs text-emerald-700 font-bold">
                  {item.f1UV}%
                  <span className="text-[10px] text-emerald-600 block">
                    +{(item.f1UV - item.f1VV).toFixed(1)}%
                  </span>
                </td>
                <td className="model-cell">
                  <div className="flex items-center gap-1.5 text-stone-700 text-xs">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>{item.evidenceSource}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
