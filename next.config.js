/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/api/survey/submit": ["./data/resources.json"],
      "/api/recommendations/generate": ["./data/resources.json"],
      "/survey": ["./data/resources.json"],
    },
  },
};

module.exports = nextConfig;
