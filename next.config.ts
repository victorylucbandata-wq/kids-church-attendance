import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old links: the Sheets-era form and the single-church kiosk paths.
  async redirects() {
    return [
      { source: "/kids-attendance", destination: "/", permanent: false },
      // Pre-multi-church kiosk links (and QR codes) land on the church picker.
      { source: "/check-in/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
