import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Droplets,
  Radar,
  Activity,
  Wind,
  SlidersHorizontal,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Compass
} from "lucide-react";

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  tag?: string;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Mission Overview", path: "/" },
  { icon: Droplets, label: "Live Spill Simulator", path: "/simulation", tag: "60 FPS" },
  { icon: Radar, label: "Detection Studio", path: "/detection", tag: "Dual" },
  { icon: Activity, label: "Look-Alike Feed", path: "/feed" },
  { icon: Wind, label: "Wind Lab (Perturbation)", path: "/wind-lab", tag: "Test" },
  { icon: SlidersHorizontal, label: "Model Transparency", path: "/transparency" },
  { icon: FileSpreadsheet, label: "Incident History", path: "/incidents" },
];


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground" style={{ backgroundColor: "#F7F3EA" }}>
      {/* Sidebar */}
      <aside
        className={`transition-all duration-300 flex flex-col z-30 shrink-0 select-none ${
          collapsed ? "w-16" : "w-64"
        }`}
        style={{
          backgroundColor: "#24201E",
          borderRight: "1.5px solid #3E3833",
          boxShadow: "3px 0 0 rgba(62, 56, 51, 0.15)"
        }}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-700">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500 text-white shadow-sm font-bold">
                <Compass size={20} />
              </div>
              <div className="brand-wordmark">
                Oil<span>Shield</span>
                <span className="text-xs ml-1.5 font-mono text-stone-400 font-normal">SAR-UV</span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500 text-white shadow-sm font-bold">
              <Compass size={18} />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-stone-400 hover:text-white p-1 rounded hover:bg-stone-800 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <a
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? "bg-sky-500 text-white shadow-sm translate-x-1"
                      : "text-stone-300 hover:bg-stone-800 hover:text-white"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-white" : "text-stone-400 group-hover:text-white"} />
                  {!collapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}
                  {!collapsed && item.tag && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                        isActive ? "bg-white/20 text-white" : "bg-stone-800 text-sky-400"
                      }`}
                    >
                      {item.tag}
                    </span>
                  )}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Footer Note */}
        {!collapsed && (
          <div className="p-3 m-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5 text-sky-400 font-mono font-bold mb-1">
              <ShieldAlert size={14} />
              <span>UNet++ SCSE</span>
            </div>
            <p className="text-[10px] text-stone-400">
              Chen et al., IEEE JSTARS 2026. External ERA5 U10/V10 wind vector coupling.
            </p>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
