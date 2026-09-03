import type { Metadata } from "next";
import { SfProDisplay } from "sf-pro/display";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProvider";
import { Toaster } from "@/components/ui/sonner";
import {
  ContextProvider,
  UserLoader,
} from "@/components/providers/ContextProvider";

export const metadata: Metadata = {
  title: {
    default: "CollabDraw - Collaborative whiteboards that feel alive",
    template: "%s | CollabDraw",
  },
  description:
    "A real-time collaborative canvas for teams that think visually.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={SfProDisplay.className} suppressHydrationWarning>
        <AppProviders>
          <ContextProvider>
            <UserLoader>{children}</UserLoader>
          </ContextProvider>
        </AppProviders>
        <Toaster richColors />
      </body>
    </html>
  );
}
