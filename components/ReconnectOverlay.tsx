"use client";

interface Props {
  visible: boolean;
  isOnline: boolean;
}

export default function ReconnectOverlay({ visible, isOnline }: Props) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm rounded-xl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-sky-500/40 border-t-sky-400 rounded-full animate-spin" />
        <p className="text-sm font-medium text-sky-300">
          {isOnline ? "Reconnecting..." : "Waiting for network..."}
        </p>
        {!isOnline && (
          <p className="text-xs text-slate-500">Stream will resume automatically</p>
        )}
      </div>
    </div>
  );
}
