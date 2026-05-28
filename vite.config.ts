import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Read package.json version
const pkgPath = path.resolve(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const appVersion = `${pkg.version}-${Date.now()}`;

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Generate version.json for the client to poll
    const publicDir = path.resolve(__dirname, 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify({ version: appVersion }));

    return {
      define: {
        __APP_VERSION__: JSON.stringify(appVersion),
      },
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
            // Manual chunking disabled temporarily to debug runtime errors
          }
        },
        chunkSizeWarningLimit: 1000,
      }
    };
});