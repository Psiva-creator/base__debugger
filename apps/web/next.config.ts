import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "chronovm-core",
    "chronovm-analyze",
    "chronovm-graph",
    "chronovm-model",
    "chronovm-narrate",
    "chronovm-explain",
    "chronovm-insight",
    "chronovm-explain-ai",
  ],
};

export default nextConfig;
