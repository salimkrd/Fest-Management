import type { NextConfig } from "next";
import { UNIFIED_STAFF_LOGIN_ROUTE } from "./src/lib/authRoutes";

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin'],
  async redirects() {
    return [
      // Keep old shared /public homepage links working without affecting subroutes.
      { source: '/public', destination: '/', permanent: true },
      // Retire legacy staff login entry points and redirect to the unified staff login route.
      // Next.js preserves query parameters on redirects automatically.
      { source: '/admin/login', destination: UNIFIED_STAFF_LOGIN_ROUTE, permanent: false },
      { source: '/team/login', destination: UNIFIED_STAFF_LOGIN_ROUTE, permanent: false },
      { source: '/management', destination: UNIFIED_STAFF_LOGIN_ROUTE, permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
