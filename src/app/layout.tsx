import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { FestProvider } from "@/context/FestContext";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fest Management System | Sahithyolsav 2025",
  description: "Enterprise Festival Operations, Participant Management, Live Scoring & Results Verification",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="min-h-screen bg-white text-[#111111] font-sans antialiased">
        <FestProvider>
          {children}
        </FestProvider>
      </body>
    </html>
  );
}
