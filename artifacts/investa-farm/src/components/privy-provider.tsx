import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim() ?? "";

export const isPrivyConfigured = Boolean(privyAppId);

export function PrivyAppProvider({ children }: { children: ReactNode }) {
  if (!privyAppId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "google", "apple"],
        appearance: {
          theme: "light",
          accentColor: "#4F46E5",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
