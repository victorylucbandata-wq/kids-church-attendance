import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old Sheets-era form lived here; send any saved links to the current check-in.
  async redirects() {
    return [{ source: "/kids-attendance", destination: "/", permanent: false }];
  },
};

export default nextConfig;
