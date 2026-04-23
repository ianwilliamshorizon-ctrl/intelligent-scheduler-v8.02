import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: {
          clientPort: 443,
        },
        proxy: {
          '/api': {
            target: 'https://uk.api.vehicledataglobal.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
          },
        },
      },
      plugins: [
        tailwindcss(), // Move Tailwind to the top of the array
        react()
      ], 
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-ui': ['lucide-react', '@mui/material', '@emotion/react', '@emotion/styled'],
              'vendor-charts': ['recharts'],
              'vendor-utils': ['lodash', 'date-fns', 'papaparse'],
              'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            }
          }
        },
        chunkSizeWarningLimit: 2000,
      }
    };
});