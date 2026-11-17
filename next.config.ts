import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local development is accessed through 127.0.0.1; Next 16 blocks dev
  // resources for origins that are not explicitly allowed.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
