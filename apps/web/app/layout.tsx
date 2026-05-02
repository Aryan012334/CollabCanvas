import type { Metadata } from "next";
import { SfProDisplay } from "sf-pro/display";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProvider";
import { Toaster } from "@/components/ui/sonner";
import {
  Context,
  ContextProvider,
  UserLoader,
} from "@/components/providers/ContextProvider";

export const metadata: Metadata = {
  title: "Excalidraw Clone",
  description: "Excalidraw on steroids",
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
