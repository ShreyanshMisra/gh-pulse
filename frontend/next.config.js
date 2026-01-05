/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone for Docker builds
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
};

module.exports = nextConfig;
