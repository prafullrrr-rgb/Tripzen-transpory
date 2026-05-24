import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { api } from "@/src/api/client";

const BG_TASK = "tripzen-bg-location";

/**
 * Defines the global background task once at module load (idempotent).
 * Pushes each fix to backend via /api/trips/{tripId}/location.
 * The tripId is stored on `Location.startLocationUpdatesAsync(taskName, options)` via `options.deferredUpdatesInterval` is not where; we use `options.taskName` data — pass via `Notifications` or store it via AsyncStorage.
 */
let currentTripIdRef: { value: string | null } = { value: null };

if (!TaskManager.isTaskDefined(BG_TASK)) {
  TaskManager.defineTask(BG_TASK, async ({ data, error }: any) => {
    if (error || !data) return;
    const locations = (data.locations as Location.LocationObject[]) || [];
    const tripId = currentTripIdRef.value;
    if (!tripId || locations.length === 0) return;
    const last = locations[locations.length - 1];
    try {
      await api.post(`/trips/${tripId}/location`, {
        lat: last.coords.latitude,
        lng: last.coords.longitude,
      });
    } catch {
      // silent
    }
  });
}

export async function startBackgroundTracking(tripId: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") {
      // We can still do foreground tracking; caller can fall back.
      return false;
    }
    currentTripIdRef.value = tripId;
    const already = await Location.hasStartedLocationUpdatesAsync(BG_TASK);
    if (already) return true;
    await Location.startLocationUpdatesAsync(BG_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      deferredUpdatesInterval: 5000,
      foregroundService: {
        notificationTitle: "TripZen is tracking your route",
        notificationBody: "Live GPS updates are being sent to parents.",
        notificationColor: "#FCB813",
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundTracking() {
  if (Platform.OS === "web") return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BG_TASK);
    if (started) await Location.stopLocationUpdatesAsync(BG_TASK);
  } catch {
    // ignore
  } finally {
    currentTripIdRef.value = null;
  }
}

export async function isBackgroundTrackingActive(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(BG_TASK);
  } catch {
    return false;
  }
}
