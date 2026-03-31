import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  output: "standalone",
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
