import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirm dialog.
 * On native: uses Alert.alert with Cancel/Confirm buttons.
 * On web: signs out immediately (RN-Web's Alert polyfill ignores the buttons array,
 * and window.confirm() is unreliable across browsers).
 */
export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = "OK",
) {
  if (Platform.OS === "web") {
    onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
