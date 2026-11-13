import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), ...(mode === 'preview' ? [viteSingleFile()] : [])],
    define: { __PREVIEW__: mode === 'preview' },
    server: { proxy: { '/api': env.VITE_API_PROXY || 'http://localhost:5005' } }
  };
});
