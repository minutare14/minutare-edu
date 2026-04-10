import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function copyStaticDirs(directories: string[]) {
  return {
    name: 'copy-static-dirs',
    closeBundle() {
      const distRoot = path.resolve(__dirname, 'dist');

      directories.forEach((directory) => {
        const source = path.resolve(__dirname, directory);
        const target = path.join(distRoot, directory);

        if (!fs.existsSync(source)) {
          return;
        }

        fs.rmSync(target, {recursive: true, force: true});
        fs.cpSync(source, target, {recursive: true});
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), copyStaticDirs(['js', 'content', 'vendor', 'ferramentas'])],
    build: {
      rollupOptions: {
        input: {
          dashboardAi: path.resolve(__dirname, 'dashboard-ai.html'),
          exam: path.resolve(__dirname, 'exam.html'),
        },
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
