import type { Metadata } from "next";
import "./globals.css";
import { FestProvider } from "@/context/FestContext";

export const metadata: Metadata = {
  title: "Festival Management | Official Festival Portal",
  description: "Enterprise Festival Operations, Participant Management, Live Scoring & Results Verification",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Bruno+Ace&family=Bruno+Ace+SC&family=Cinzel:wght@400;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600&family=Sora:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white text-[#111111] font-sans antialiased">
        <FestProvider>
          {children}
        </FestProvider>
      </body>
    </html>
  );
}
