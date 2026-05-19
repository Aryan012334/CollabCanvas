/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" tells Next.js to bundle everything needed to run
  // into a single self-contained folder (.next/standalone).
  // This is what makes the Docker image small — no need to copy
  // all of node_modules into the final container.
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
