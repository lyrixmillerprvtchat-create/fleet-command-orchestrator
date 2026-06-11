"use client";

import { useState } from "react";
import { Fleet, FleetAction } from "@/types/fleet";

const STATUS_STYLES: Record<Fleet["status"], string> = {
  Online: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Offline: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  Busy: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const STATUS_DOT: Record<Fleet["status"], string> = {
  Online: "bg-emerald-400 animate-pulse",
  Offline: "bg-slate-500",
  Busy: "bg-amber-400 animate-pulse",
};

const ACTIONS: { label: string; action: FleetAction; icon: string }[] = [
  { label: "Launch App", action: "launch_app", icon: "▶" },
  { label: "Execute Task", action: "execute_task", icon: "⚡" },
  { label: "Screenshot", action: "screenshot", icon: "📷" },
  { label: "Restart", action: "restart", icon: "↺" },
];

interface Props {
  fleet: Fleet;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Fleet["status"]) => void;
}

export default function FleetNode({ fleet, onDelete, onStatusChange }: Props) {
  const [loading, setLoading] = useState<FleetAction | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function runAction(action: FleetAction) {
    setLoading(action);
    setLastResult(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fleet_id: fleet.id, action }),
      });
      const data = await res.json();
      setLastResult(data.message ?? (res.ok ? "Done" : "Failed"));
      onStatusChange(fleet.id, res.ok ? "Online" : "Offline");
    } catch {
      setLastResult("Network error");
      onStatusChange(fleet.id, "Offline");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove ${fleet.device_name}?`)) return;
    await fetch(`/api/fleets/${fleet.id}`, { method: "DELETE" });
    onDelete(fleet.id);
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 flex flex-col gap-4 hover:border-slate-600/70 transition-all duration-200 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate text-sm">{fleet.device_name}</h3>
          <p className="text-xs text-slate-500 truncate mt-0.5">{fleet.api_url}</p>
        </div>
        <span
          className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
            STATUS_STYLES[fleet.status]
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[fleet.status]}`} />
          {fleet.status}
        </span>
      </div>

      {/* Tags */}
      {fleet.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fleet.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-400 border border-slate-600/40"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map(({ label, action, icon }) => (
          <button
            key={action}
            onClick={() => runAction(action)}
            disabled={!!loading || fleet.status === "Offline"}
            className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-sky-600/80 text-slate-300 hover:text-white border border-slate-600/40 hover:border-sky-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading === action ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>{icon}</span>
            )}
            {label}
          </button>
        ))}
      </div>

      {/* Last result */}
      {lastResult && (
        <p className="text-xs text-slate-400 bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-700/40 truncate">
          {lastResult}
        </p>
      )}

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="text-xs text-slate-600 hover:text-red-400 transition-colors self-end"
      >
        Remove node
      </button>
    </div>
  );
}
