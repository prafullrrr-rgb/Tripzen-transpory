import { Platform } from "react-native";

/**
 * Lightweight wrapper around react-native-nfc-manager.
 * Returns null on web / unsupported devices / Expo Go.
 * The NFC tag payload is expected to be a TRIPZEN-XXXXXXXX string in the first NDEF text record.
 */
export async function isNfcSupported(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const NfcManager = (await import("react-native-nfc-manager")).default;
    const supported = await NfcManager.isSupported();
    return !!supported;
  } catch {
    return false;
  }
}

export async function scanNfcTag(): Promise<string | null> {
  if (Platform.OS === "web") return null;
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
