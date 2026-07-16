import { resolve } from 'node:path';

import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      resolve: {
        alias: {
          react: resolve(import.meta.dirname, 'node_modules/react'),
          'react-dom': resolve(import.meta.dirname, 'node_modules/react-dom'),
        },
      },
      server: {
        proxy: {
          '/admin-api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/admin-api/, ''),
            target: 'http://localhost:48080/admin-api',
            ws: true,
          },
        },
      },
    },
  };
});
