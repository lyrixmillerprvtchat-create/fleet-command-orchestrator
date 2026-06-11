"use client";

import { useEffect, useState, useCallback } from "react";
import FleetNode from "@/components/FleetNode";
import AddFleetModal from "@/components/AddFleetModal";
import { Fleet } from "@/types/fleet";

const FILTER_TAGS = ["All", "Online", "Offline", "Busy", "Bot", "Social", "Browser"];

export default function DashboardPage() {
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const fetchFleets = useCallback(async () => {
    const res = await fetch("/api/fleets");
    if (res.ok) setFleets(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFleets();
    const interval = setInterval(fetchFleets, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, [fetchFleets]);

  function handleDelete(id: string) {
    setFleets((prev) => prev.filter((f) => f.id !== id));
  }

  function handleStatusChange(id: string, status: Fleet["status"]) {
    setFleets((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
  }

  const filtered = fleets.filter((f) => {
    const matchesSearch =
      !search ||
      f.device_name.toLowerCase().includes(search.toLowerCase()) ||
      f.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    if (filter === "All") return matchesSearch;
    if (["Online", "Offline", "Busy"].includes(filter))
      return f.status === filter && matchesSearch;
    return f.tags.includes(filter) && matchesSearch;
  });

  const stats = {
    total: fleets.length,
    online: fleets.filter((f) => f.status === "Online").length,
    busy: fleets.filter((f) => f.status === "Busy").length,
    offline: fleets.filter((f) => f.status === "Offline").length,
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 text-sm font-bold">
              F
            </div>
            <span className="font-semibold text-white text-sm">
              Fleet Command
            </span>
            <span className="hidden sm:block text-xs text-slate-500">
              Orchestrator
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <span className="text-base leading-none">+</span>
              Add Node
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Nodes", value: stats.total, color: "text-white" },
            { label: "Online", value: stats.online, color: "text-emerald-400" },
            { label: "Busy", value: stats.busy, color: "text-amber-400" },
            { label: "Offline", value: stats.offline, color: "text-slate-500" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4"
            >
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search nodes or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/60 transition-colors"
          />
          <div className="flex gap-2 flex-wrap">
            {FILTER_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilter(tag)}
                className={`text-xs px-3 py-2 rounded-lg border transition-colors font-medium ${
                  filter === tag
                    ? "bg-sky-600/30 border-sky-500/50 text-sky-300"
                    : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-600"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Fleet grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Loading fleet nodes...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center text-2xl text-slate-600">
              ◻
            </div>
            <div className="text-center">
              <p className="text-slate-400 font-medium">No fleet nodes found</p>
              <p className="text-sm text-slate-600 mt-1">
                {fleets.length === 0
                  ? "Add your first device to get started"
                  : "Try adjusting your search or filters"}
              </p>
            </div>
            {fleets.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                Add First Node
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((fleet) => (
              <FleetNode
                key={fleet.id}
                fleet={fleet}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <AddFleetModal
          onClose={() => setShowModal(false)}
          onAdded={(fleet) => {
            setFleets((prev) => [fleet, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
