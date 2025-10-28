// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config: any) => {
    // Force Paper.js to use the browser-safe version
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "paper": "paper/dist/paper-core.js",
    };
    return config;
  },
};

export default nextConfig;
