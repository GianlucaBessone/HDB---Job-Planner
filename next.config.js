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
  // react-pdf trae su propio reconciler: si Next lo empaqueta en la capa de servidor
  // usa la build "react-server" de React 19 y falla ("reading 'S'"). Se carga desde node_modules.
  serverExternalPackages: ['@react-pdf/renderer'],
};

module.exports = withPWA(nextConfig);
// Reload trigger: 2026-09-10-dynamic-price-lists


