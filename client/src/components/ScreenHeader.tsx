import React from "react";
import { Bell, Search, Compass, RefreshCw } from "lucide-react";

export function ScreenHeader({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="screen-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="marker-heading">{title}</h1>
      </div>
      <div className="header-actions">
        {children}
        <button className="icon-button" aria-label="Refresh feeds" title="Refresh Live Feeds">
          <RefreshCw size={16} />
        </button>
        <button className="icon-button has-notification" aria-label="View alerts" title="Active Alerts">
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
}

export function RiskBadge({ tier }: { tier: "low" | "medium" | "high" }) {
  const labelMap = {
    low: "Suppressed Look-Alike",
    medium: "Look-Alike Candidate",
    high: "Verified Oil Slick"
  };
  return (
    <span className={`risk-badge risk-${tier}`}>
      <span className="badge-dot" />
      {labelMap[tier]}
    </span>
  );
}
