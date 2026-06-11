"use client";

import { useState } from "react";
import { Fleet } from "@/types/fleet";

interface Props {
  onClose: () => void;
  onAdded: (fleet: Fleet) => void;
}

export default function AddFleetModal({ onClose, onAdded }: Props) {
  const [form, setForm] = useState({
    device_name: "",
    api_url: "",
    status: "Offline" as Fleet["status"],
    tags: "",
    username: "",
    access_key: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      device_name: form.device_name.trim(),
      api_url: form.api_url.trim(),
      status: form.status,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      credentials:
        form.username || form.access_key
          ? { username: form.username, access_key: form.access_key }
          : null,
    };

    const res = await fetch("/api/fleets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to add fleet");
      setSaving(false);
      return;
    }

    const fleet: Fleet = await res.json();
    onAdded(fleet);
    onClose();
  }

  const inputClass =
    "w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/70 transition-colors";

  const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <h2 className="font-semibold text-white">Add Fleet Node</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelClass}>Device Name *</label>
            <input
              className={inputClass}
              placeholder="Trading-Bot-VM-01"
              value={form.device_name}
              onChange={(e) => setForm({ ...form, device_name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Appium API URL *</label>
            <input
              className={inputClass}
              placeholder="https://hub-cloud.browserstack.com/wd/hub"
              value={form.api_url}
              onChange={(e) => setForm({ ...form, api_url: e.target.value })}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Initial Status</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as Fleet["status"] })
              }
            >
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="Busy">Busy</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Tags (comma-separated)</label>
            <input
              className={inputClass}
              placeholder="Bot, Social, Browser"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>

          <div className="border-t border-slate-700/50 pt-4">
            <p className="text-xs text-slate-500 mb-3">
              Credentials (BrowserStack / LambdaTest)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Username</label>
                <input
                  className={inputClass}
                  placeholder="your_username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Access Key</label>
                <input
                  type="password"
                  className={inputClass}
                  placeholder="••••••••"
                  value={form.access_key}
                  onChange={(e) =>
                    setForm({ ...form, access_key: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-600/50 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
