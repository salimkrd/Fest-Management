import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { FestProvider } from "@/context/FestContext";
import { ThemeService } from "@/services/themeService";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

// Festival identity is a live Chief Admin setting. Render it from Firestore on
// the server so the first HTML response never flashes the obsolete client default.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Festival Management | Official Festival Portal",
  description: "Enterprise Festival Operations, Participant Management, Live Scoring & Results Verification",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialTheme = await ThemeService.getPublishedTheme().catch((error) => {
    console.warn("[RootLayout] Could not load the published festival identity:", error);
    return null;
  });

  return (
    <html lang="en" className={montserrat.variable}>
      <body className="min-h-screen bg-white text-[#111111] font-sans antialiased">
        <FestProvider initialTheme={initialTheme}>
          {children}
        </FestProvider>
      </body>
    </html>
  );
}
