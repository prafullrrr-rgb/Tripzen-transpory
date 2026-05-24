import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export type LiveTrip = {
  id: string;
  route_id: string;
  route_name: string;
  status: string;
  current_lat: number;
  current_lng: number;
  current_stop_index: number;
  boarded_student_ids: string[];
  checked_out_student_ids: string[];
};

/**
 * Subscribes to /api/ws/trip/{tripId} for real-time location updates.
 * Returns latest trip snapshot and a `connected` flag.
 * Falls back gracefully — caller should still poll as backup.
 */
export function useLiveTrip(tripId: string | null | undefined) {
  const [trip, setTrip] = useState<LiveTrip | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!tripId) {
      setConnected(false);
      setTrip(null);
      return;
    }
    let cancelled = false;

    const baseHttp = process.env.EXPO_PUBLIC_BACKEND_URL || "";
    // Convert https:// → wss:// or http:// → ws://
    const wsUrl = baseHttp.replace(/^https?/i, (m) => (m.toLowerCase() === "https" ? "wss" : "ws")) + `/api/ws/trip/${tripId}`;

    const connect = () => {
      if (cancelled) return;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          if (cancelled) return;
          setConnected(true);
          // periodic keepalive ping
          if (pingTimerRef.current) clearInterval(pingTimerRef.current);
          pingTimerRef.current = setInterval(() => {
            try { ws.send("ping"); } catch { /* noop */ }
          }, 25000);
        };
        ws.onmessage = (ev: any) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(ev.data);
            if (data?.trip) setTrip(data.trip as LiveTrip);
          } catch {
            // ignore non-JSON (keepalive/pong)
          }
        };
        ws.onerror = () => {
          setConnected(false);
        };
        ws.onclose = () => {
          setConnected(false);
          if (pingTimerRef.current) {
            clearInterval(pingTimerRef.current);
            pingTimerRef.current = null;
          }
          if (!cancelled) {
            reconnectTimerRef.current = setTimeout(connect, 3000);
          }
        };
      } catch (e) {
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(connect, 5000);
        }
      }
    };

    // Slight delay on web to avoid blocking initial render
    const startDelay = Platform.OS === "web" ? 300 : 0;
    const t = setTimeout(connect, startDelay);

    return () => {
      cancelled = true;
      clearTimeout(t);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      try { wsRef.current?.close(); } catch { /* noop */ }
      wsRef.current = null;
    };
  }, [tripId]);

  return { trip, connected };
}
