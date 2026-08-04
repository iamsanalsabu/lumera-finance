import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumera Finance | AI-Powered Finance Keeper",
  description: "Track your expenses and revenue with the power of AI voice input.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
