import { Platform } from "react-native";
import Constants from "expo-constants";

// Detect Expo Go — NFC isn't available there. Also disabled for web.
const isExpoGo = (Constants as any)?.appOwnership === "expo";
const NFC_DISABLED = Platform.OS === "web" || isExpoGo;

/**
 * Lightweight wrapper around react-native-nfc-manager.
 * Returns null on web / Expo Go / unsupported devices.
 * Tag payload expected to be a TRIPZEN-XXXXXXXX string in the first NDEF text record.
 */
export async function isNfcSupported(): Promise<boolean> {
  if (NFC_DISABLED) return false;
  try {
    const NfcManager = (await import("react-native-nfc-manager")).default;
    const supported = await NfcManager.isSupported();
    return !!supported;
  } catch {
    return false;
  }
}

export async function scanNfcTag(): Promise<string | null> {
  if (NFC_DISABLED) return null;
  try {
    const mod = await import("react-native-nfc-manager");
    const NfcManager: any = mod.default;
    const NfcTech = (mod as any).NfcTech;
    const Ndef = (mod as any).Ndef;

    await NfcManager.start();
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    let value: string | null = null;
    const records = tag?.ndefMessage || [];
    if (records.length && Ndef?.text?.decodePayload) {
      try {
        value = Ndef.text.decodePayload(records[0].payload);
      } catch {
        value = null;
      }
    }
    if (!value && tag?.id) value = String(tag.id);
    return value;
  } catch {
    return null;
  } finally {
    try {
      const NfcManager = (await import("react-native-nfc-manager")).default;
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // ignore
    }
  }
}
