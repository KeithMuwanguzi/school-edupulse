/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async redirects() {
    return [
      { source: "/login", destination: "/", permanent: false },
      { source: "/admin/login", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
