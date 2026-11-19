import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const BUILD = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';
// versão e commit vão no report de bug (GITHUB_SHA existe no GitHub Actions; no PC fica "local")
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
    // duas páginas: o jogo (index.html) e a wiki (wiki/index.html → <site>/wiki/)
    rollupOptions: { input: { main: 'index.html', wiki: 'wiki/index.html' } },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD__: JSON.stringify(BUILD),
  },
  // version.json: o jogo aberto consulta e avisa quando há deploy novo (src/platform/update.ts)
  plugins: [
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
      },
    },
  ],
});
