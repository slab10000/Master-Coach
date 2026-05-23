/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "100mb" },
  },
  images: { unoptimized: true },
};

export default nextConfig;
