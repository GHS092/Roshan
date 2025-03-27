/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Resuelve el problema con el módulo 'canvas' de Konva
    if (isServer) {
      config.externals = [...config.externals, { canvas: 'canvas' }];
    }

    return config;
  },
};

module.exports = nextConfig; 