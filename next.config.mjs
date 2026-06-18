/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    // Enables the forbidden() / unauthorized() navigation helpers. Used by the
    // lecturer student pages to return a real 403 when a lecturer opens a
    // course they don't teach (see app/forbidden.tsx).
    authInterrupts: true,
  },
};

export default nextConfig;
