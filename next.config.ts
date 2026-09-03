import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': ['./fingerprint-code/**/*'],
  },
  experimental: {
  }
};

export default nextConfig;
