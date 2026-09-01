import { useState } from "react";
import { ScreenHeader, RiskBadge } from "@/components/ScreenHeader";
import { candidateFeed } from "@/lib/demoData";
import { ChevronDown, ChevronUp, Wind, Compass, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function LookAlikeFeed() {
  const [expandedId, setExpandedId] = useState<string | null>("SAR-2026-CS-02");
  const [filterTier, setFilterTier] = useState<string>("all");

  const filtered = candidateFeed.filter(
    (item) => filterTier === "all" || item.tier === filterTier
  );

  return (
    <div className="screen-shell">
      <ScreenHeader
        eyebrow="Real-Time Look-Alike Surveillance Stream"
        title="Candidate Dark Patch Feed"
      />

      <section className="hand-note note-blue">
        <span>Surveillance Active</span>
        <strong>Continuous dark patch screening across Sentinel-1 swaths</strong>
        <small>Real-time physical wind attribution explaining why candidates are verified or suppressed</small>
      </section>

      {/* Filter Strip */}
      <div className="sketch-card filter-strip">
        <div className="filter-copy">
          <strong>Filter by classification tier:</strong>
          <span>Showing {filtered.length} candidates</span>
        </div>
        <div className="filter-controls">
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="font-mono text-xs"
          >
            <option value="all">All Classification Tiers</option>
            <option value="high">High Risk (Verified Slicks)</option>
            <option value="medium">Medium Risk (Ambiguous / Biogenic)</option>
            <option value="low">Low Risk (Suppressed Look-Alikes)</option>
          </select>
        </div>
      </div>

      {/* Expandable Feed Card */}
      <div className="sketch-card feed-card">
        <div className="feed-grid feed-head">
          <span>Candidate ID / Region</span>
          <span>Target Location</span>
          <span>Local Wind</span>
          <span>Risk Tier</span>
          <span>Action Status</span>
          <span></span>
        </div>

        {filtered.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="feed-grid feed-row cursor-pointer"
              >
                <div>
                  <strong className="mono text-xs">{item.id}</strong>
                  <small>{item.region}</small>
                </div>
                <div>
                  <span className="text-xs font-semibold">{item.location}</span>
                  <small>{item.lookAlikeRisk}</small>
                </div>
                <div>
                  <span className="mono font-bold text-sky-700 text-xs">{item.windSpeed} m/s</span>
                  <small>{item.windDir}</small>
                </div>
                <div>
                  <RiskBadge tier={item.tier} />
                </div>
                <div>
                  <span className={`action action-${item.tier}`}>
                    {item.action}
                  </span>
                </div>
                <div className="flex justify-center text-stone-500">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Expandable Explanation Panel (from chargeBackShield) */}
              {isExpanded && (
                <div className="explain-panel">
                  <div>
                    <p className="eyebrow">Physical Attribution Summary</p>
                    <h3>{item.classification}</h3>
                    <p className="body-copy">
                      Under single-channel SAR-VV, this candidate triggered an alert confidence of{" "}
                      <strong>{item.confidenceVV}%</strong>. With ERA5 wind-vector integration (SAR-UV), confidence was recalibrated to{" "}
                      <strong>{item.confidenceUV}%</strong>.
                    </p>
                    <div className="mt-4 p-3 bg-stone-100/80 rounded-xl border border-dashed border-stone-300 text-xs space-y-1">
                      <div className="text-stone-500 font-mono text-[10px] uppercase">Decision Engine</div>
                      <div className="font-bold text-stone-800">{item.action}</div>
                      <div className="text-stone-600 text-[11px]">{item.lookAlikeRisk}</div>
                    </div>
                  </div>

                  <div>
                    <p className="eyebrow">Wind Vector &amp; Environmental Contribution</p>
                    <div className="contribution-list">
                      {item.factors.map((factor, idx) => {
                        const isLower = item.tier === "low" || factor.feature.includes("Wind");
                        return (
                          <div className="contribution" key={idx}>
                            <div className="contribution-label">
                              <span>{factor.feature}</span>
                              <small>{factor.value}</small>
                            </div>
                            <div className="contribution-track">
                              <i
                                className={isLower ? "lower" : "raise"}
                                style={{ width: `${60 + idx * 15}%` }}
                              />
                            </div>
                            <strong className={isLower ? "lower-text" : "raise-text"}>
                              {isLower ? "-68%" : "+84%"}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
