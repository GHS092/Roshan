/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para permitir imágenes de cualquier dominio
  images: {
    domains: ['*'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig; 