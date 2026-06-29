"use client";

import { useRef, useState } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import ReconnectOverlay from "./ReconnectOverlay";
import { Fleet } from "@/types/fleet";

interface Props {
  fleet: Fleet;
  onClose: () => void;
}

export default function RemoteDesktopView({ fleet, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  async function startSession() {
    setSessionLoading(true);
    setSessionError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fleet_id: fleet.id }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const { token: t } = await res.json();
      setToken(t);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Session failed");
    } finally {
      setSessionLoading(false);
    }
  }

  const { state, error, isOnline, disconnect } = useWebRTC({
    token: token ?? "",
    videoRef,
    enabled: !!token,
  });

  const showOverlay =
    state === "reconnecting" || state === "connecting";
  const isConnected = state === "connected";

  function handleClose() {
    disconnect();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-sm font-medium text-white truncate">
              {fleet.device_name}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                isConnected
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : state === "reconnecting"
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-slate-700/40 text-slate-400 border-slate-600/40"
              }`}
            >
              {state === "connected"
                ? "Live"
                : state === "connecting"
                ? "Connecting"
                : state === "reconnecting"
                ? isOnline
                  ? "Reconnecting"
                  : "Offline"
                : state === "failed"
                ? "Failed"
                : "Idle"}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Video area */}
        <div className="relative bg-black aspect-video w-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />

          <ReconnectOverlay visible={showOverlay} isOnline={isOnline} />

          {/* Not yet started */}
          {!token && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-2xl text-slate-500">
                ▶
              </div>
              <div className="text-center">
                <p className="text-slate-300 font-medium text-sm">
                  Remote Desktop — {fleet.device_name}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Creates a persistent session that survives disconnects
                </p>
              </div>
              {sessionError && (
                <p className="text-xs text-red-400 bg-red-950/40 px-3 py-1.5 rounded-lg border border-red-900/40">
                  {sessionError}
                </p>
              )}
              <button
                onClick={startSession}
                disabled={sessionLoading}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                {sessionLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                {sessionLoading ? "Starting..." : "Start Session"}
              </button>
            </div>
          )}

          {/* Connection failed */}
          {state === "failed" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90">
              <p className="text-red-400 text-sm font-medium">
                {error ?? "Connection failed"}
              </p>
              <button
                onClick={() => setToken(null)}
                className="text-xs text-sky-400 hover:text-sky-300 underline"
              >
                Start new session
              </button>
            </div>
          )}
        </div>

        {/* Error bar */}
        {error && state !== "failed" && (
          <div className="px-5 py-2.5 bg-amber-950/30 border-t border-amber-900/30">
            <p className="text-xs text-amber-400">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-600">
            Session auto-resumes on network restore — no re-login needed
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            {isOnline ? "Network OK" : "No network"}
          </div>
        </div>
      </div>
    </div>
  );
}
