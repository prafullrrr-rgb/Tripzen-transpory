import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { bootstrapI18n } from "@/src/i18n";
import { setupForegroundHandler } from "@/src/utils/pushNotifications";
import { StripeProvider } from "@/src/utils/stripe";

SplashScreen.preventAutoHideAsync();

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder";

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    bootstrapI18n()
      .catch(() => null)
      .finally(() => setI18nReady(true));
    setupForegroundHandler();
  }, []);

  useEffect(() => {
    if ((loaded || error) && i18nReady) {
      SplashScreen.hideAsync().catch(() => null);
    }
  }, [loaded, error, i18nReady]);

  if ((!loaded && !error) || !i18nReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={STRIPE_PK} merchantIdentifier="merchant.com.tripzen">
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />
          </AuthProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
