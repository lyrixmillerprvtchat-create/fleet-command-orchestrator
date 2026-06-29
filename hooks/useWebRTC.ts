"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useNetworkStatus } from "./useNetworkStatus";

export type RTCState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

interface UseWebRTCOptions {
  token: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useWebRTC({ token, videoRef, enabled }: UseWebRTCOptions) {
  const [state, setState] = useState<RTCState>("idle");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(1000);
  const mountedRef = useRef(false);
  const isOnline = useNetworkStatus();
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const destroyPC = useCallback(() => {
    clearRetry();
    const pc = pcRef.current;
    if (!pc) return;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.onicegatheringstatechange = null;
    pc.close();
    pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [clearRetry, videoRef]);

  const scheduleRetry = useCallback(
    (connectFn: () => void) => {
      clearRetry();
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30000);
      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current && isOnlineRef.current) connectFn();
      }, delay);
    },
    [clearRetry]
  );

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    destroyPC();
    if (!mountedRef.current) return;

    setState("connecting");
    setError(null);

    const retry = () => scheduleRetry(connect);

    try {
      const sessionRes = await fetch(
        `/api/session?token=${encodeURIComponent(token)}`
      );
      if (!sessionRes.ok) {
        setState("failed");
        setError("Session expired — please reconnect");
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (e) => {
        if (!mountedRef.current) return;
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0];
          setState("connected");
          retryDelayRef.current = 1000;
        }
      };

      pc.onconnectionstatechange = () => {
        if (!mountedRef.current) return;
        const s = pc.connectionState;
        if (s === "disconnected" || s === "failed") {
          setState("reconnecting");
          retry();
        } else if (s === "closed") {
          setState("idle");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering (max 3s)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") resolve();
        };
        setTimeout(resolve, 3000);
      });

      if (!mountedRef.current) return;

      await fetch("/api/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          type: "offer",
          origin: "client",
          payload: pc.localDescription,
        }),
      });

      // Poll for answer from host (30s timeout)
      let answered = false;
      for (let i = 0; i < 30 && mountedRef.current; i++) {
        const res = await fetch(
          `/api/signal?token=${encodeURIComponent(token)}&type=answer&origin=host`
        );
        const { signals } = await res.json();
        if (signals.length > 0) {
          await pc.setRemoteDescription(
            new RTCSessionDescription(signals[0].payload)
          );
          answered = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!answered && mountedRef.current) {
        throw new Error("Host did not respond — retrying");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
      setState("reconnecting");
      retry();
    }
  }, [token, destroyPC, scheduleRetry, videoRef]);

  // Reconnect immediately when network is restored
  useEffect(() => {
    if (isOnline && state === "reconnecting") {
      retryDelayRef.current = 1000;
      clearRetry();
      connect();
    }
    // intentionally only re-runs on isOnline change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Mount/unmount and enabled toggle
  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      connect();
    }
    return () => {
      mountedRef.current = false;
      destroyPC();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    state,
    error,
    isOnline,
    connect,
    disconnect: destroyPC,
  };
}
