import {defineConfig} from 'vite';
import {compileContributions, readContributionSource} from './contribution-compiler.mjs';

export default defineConfig(async () => {
  const contributions = compileContributions(await readContributionSource());
  return {
    root: new URL('./fixture', import.meta.url).pathname,
    appType: 'spa',
    esbuild: {jsx: 'automatic'},
    define: {__S8_CONTRIBUTIONS__: JSON.stringify(contributions)},
    server: {host: '127.0.0.1', strictPort: true},
  };
});
