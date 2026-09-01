import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Radar, ShieldCheck, Sparkles, Wind, Droplets } from "lucide-react";
import { Link } from "wouter";
import { ScreenHeader, RiskBadge } from "@/components/ScreenHeader";
import { kpis, sarSignalSeries, candidateFeed } from "@/lib/demoData";

export default function Overview() {
  const iconMap: Record<string, any> = {
    blue: Radar,
    orange: Wind,
    charcoal: ShieldCheck,
    pink: Sparkles,
  };

  return (
    <div className="screen-shell">
      <ScreenHeader
        eyebrow="Maritime SAR Surveillance Desk / Live View"
        title="Good morning, Operator."
      >
        <Link href="/simulation">
          <a className="solid-button bg-rose-600 hover:bg-rose-700 shadow-rose-950">
            <Droplets size={16} /> 60 FPS Live Simulator
          </a>
        </Link>
        <Link href="/detection">
          <a className="outline-button">
            <Radar size={16} /> Detection Studio
          </a>
        </Link>
      </ScreenHeader>


      {/* Hand Note Tape Banner */}
      <section className="hand-note note-blue">
        <span>Model live</span>
        <strong>UNet++ SCSE (SAR-UV) · Precision 89.4% · Recall 83.4% · FPR 2.6%</strong>
        <small>Stratified evaluation across 20 independent Sentinel-1 scenes · IEEE JSTARS 2026</small>
      </section>

      {/* KPI Grid */}
      <div className="kpi-grid">
        {kpis.map(({ label, value, note, tone }) => {
          const Icon = iconMap[tone] || Radar;
          return (
            <article className="sketch-card kpi-card" key={label}>
              <div className={`kpi-icon ${tone}`}>
                <Icon size={18} />
              </div>
              <p>{label}</p>
              <strong>{value}</strong>
              <span>
                {note} <ArrowUpRight size={14} />
              </span>
            </article>
          );
        })}
      </div>

      {/* Overview Grid: Chart + Signals */}
      <div className="overview-grid">
        <section className="sketch-card chart-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Seven-day surveillance telemetry</p>
              <h2>SAR False Alarms Suppressed by Wind Coupling</h2>
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-high" style={{ backgroundColor: "#E66C63" }} />
                SAR-VV False Alarms
              </span>
              <span>
                <i className="legend-low" style={{ backgroundColor: "#3AAE83" }} />
                SAR-UV Verified Slicks
              </span>
            </div>
          </div>

          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sarSignalSeries} margin={{ top: 12, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="uvFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3AAE83" stopOpacity={0.75} />
                    <stop offset="100%" stopColor="#3AAE83" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="vvFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#E66C63" stopOpacity={0.75} />
                    <stop offset="100%" stopColor="#E66C63" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#D9D0C2" strokeDasharray="3 5" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#7F7466", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#7F7466", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 15,
                    border: "1.5px solid #3E3833",
                    background: "#FFFCF4",
                    boxShadow: "3px 3px 0 rgba(62,56,51,0.15)",
                  }}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="sarVV_alarms"
                  stroke="#E66C63"
                  fill="url(#vvFill)"
                  strokeWidth={2}
                  name="SAR-VV Look-Alike Alarms"
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="sarUV_detected"
                  stroke="#3AAE83"
                  fill="url(#uvFill)"
                  strokeWidth={2}
                  name="SAR-UV Verified Slicks"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <aside className="sketch-card signal-card">
          <p className="eyebrow">Physical oceanography note</p>
          <h2>Why look-alikes form</h2>
          <div className="signal-list">
            <div>
              <span className="signal-nbr">01</span>
              <p>
                <strong>Capillary wave dampening</strong>
                <small>Winds &lt; 2.5 m/s eliminate high-frequency ocean roughness, mimicking oil slick radar reflection.</small>
              </p>
            </div>
            <div>
              <span className="signal-nbr">02</span>
              <p>
                <strong>Island wake sheltering (LSI)</strong>
                <small>Topography blocks wind flow, casting calm leeward wakes tens of kilometers downstream.</small>
              </p>
            </div>
            <div>
              <span className="signal-nbr">03</span>
              <p>
                <strong>Continuous U10/V10 vectors</strong>
                <small>Cartesian wind components eliminate angular 360° discontinuities, enabling robust DL gradients.</small>
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Recent Surveillance Feed Table */}
      <section className="sketch-card table-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Recent Candidate Surveillance Detections</p>
            <h2>Verified Slicks vs. Suppressed Calm Waters</h2>
          </div>
          <Link href="/feed">
            <a className="text-action inline-flex items-center gap-1">
              View complete look-alike feed <ArrowUpRight size={15} />
            </a>
          </Link>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Detection ID</th>
                <th>Region / Target</th>
                <th>Local Wind</th>
                <th>Classification Status</th>
                <th>Decision Factors</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {candidateFeed.map((item) => (
                <tr key={item.id}>
                  <td className="mono font-semibold">{item.id}</td>
                  <td>
                    <strong>{item.region}</strong>
                    <div className="text-[11px] text-stone-500">{item.location}</div>
                  </td>
                  <td>
                    <span className="mono font-bold text-sky-700">{item.windSpeed} m/s</span>
                    <div className="text-[10px] text-stone-500">{item.windDir}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <RiskBadge tier={item.tier} />
                      <span className="mono text-[11px]">
                        UV: <strong>{item.confidenceUV}%</strong>
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="factor-chips">
                      {item.factors.slice(0, 2).map((f) => (
                        <span key={f.feature}>
                          <strong>{f.feature}:</strong> {f.value}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${
                        item.tier === "high"
                          ? "bg-red-100 text-red-700 border border-red-300"
                          : item.tier === "low"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {item.action}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
