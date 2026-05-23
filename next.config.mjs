/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: "100mb" },
  },
  images: { unoptimized: true },
};

export default nextConfig;
