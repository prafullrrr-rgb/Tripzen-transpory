import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { api } from "@/src/api/client";

/**
 * Request permissions, fetch Expo push token, and register it on the backend.
 * Safe no-op on web and on Expo Go for iOS (where remote push is blocked).
 */
export async function registerForPushAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    // Channel for Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FCB813",
      });
    }

    const settings = await Notifications.getPermissionsAsync();
    let finalStatus = settings.status;
    if (settings.status !== "granted" && settings.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== "granted") return null;

    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResp?.data;
    if (token) {
      try {
        await api.post("/users/push-token", { token, platform: Platform.OS });
      } catch {
        // Silent — server might be unreachable; will retry on next launch
      }
    }
    return token || null;
  } catch {
    return null;
  }
}

export function setupForegroundHandler() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      } as any),
    });
  } catch {
    // ignore on web
  }
}
