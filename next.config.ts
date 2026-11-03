import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Lets phones on the same network open the dev server (e.g. http://192.168.x.x:3000)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // The show list now lives on the home page
  async redirects() {
    return [{ source: "/shows", destination: "/", permanent: false }];
  },
};

export default nextConfig;
