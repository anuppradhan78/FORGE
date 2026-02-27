import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Footer from "@/components/Footer";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "FORGE - Forged On-chain Regulated Governance Engine",
  description: "Autonomous AI agent platform for agentic crypto commerce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-forge-dark text-forge-light`}
      >
        <header className="bg-gradient-to-r from-forge-primary to-forge-secondary shadow-lg sticky top-0 z-50 animate-slideIn">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-forge-accent rounded-lg flex items-center justify-center font-bold text-lg sm:text-xl shadow-lg animate-pulse-glow">
                  F
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white gradient-text">FORGE</h1>
                  <p className="text-[10px] sm:text-xs text-forge-light/80 hidden sm:block">Forged On-chain Regulated Governance Engine</p>
                  <p className="text-[10px] text-forge-light/80 sm:hidden">Agentic Commerce Platform</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="px-2 sm:px-3 py-1 bg-forge-success/20 text-forge-success rounded-full text-xs sm:text-sm font-medium flex items-center gap-1 border border-forge-success/30">
                  <span className="w-2 h-2 bg-forge-success rounded-full animate-pulse"></span>
                  <span className="hidden sm:inline">Live</span>
                  <span className="sm:hidden">●</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="min-h-screen animate-fadeIn">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
