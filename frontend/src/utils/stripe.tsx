// Web stub for Stripe — Metro picks this over .native on web platform.
import React from "react";

export const StripeProvider: React.FC<{ children: React.ReactNode; publishableKey?: string; merchantIdentifier?: string }> = ({ children }) => <>{children}</>;

export function useStripe() {
  return {
    initPaymentSheet: null as unknown as (opts: any) => Promise<{ error?: { message: string; code?: string } }>,
    presentPaymentSheet: null as unknown as () => Promise<{ error?: { message: string; code?: string } }>,
  };
}
