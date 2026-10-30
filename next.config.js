const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  customWorkerDir: "worker",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@react-pdf/renderer'],
};

module.exports = withPWA(nextConfig);
// Reload trigger: 2026-09-10-dynamic-price-lists


