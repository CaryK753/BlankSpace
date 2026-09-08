import {defineConfig} from '@playwright/test';

const baseURL = process.env.S8_BASE_URL;
if (!baseURL) throw new Error('S8_BASE_URL is required; use run-playwright.mjs.');

const shared = {
  baseURL,
  locale: 'en-US',
  timezoneId: 'UTC',
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
  serviceWorkers: 'block',
  trace: 'retain-on-failure',
};

export default defineConfig({
  testDir: './tests',
  outputDir: process.env.S8_OUTPUT_DIR,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  expect: {toHaveScreenshot: {threshold: 0.2, maxDiffPixels: 100, animations: 'disabled', caret: 'hide'}},
  snapshotPathTemplate: '{testDir}/snapshots/{platform}/{projectName}/{arg}{ext}',
  projects: [
    {name: 'chromium-canonical', use: {...shared, browserName: 'chromium'}},
    {name: 'firefox-behavior', use: {...shared, browserName: 'firefox'}},
    {name: 'webkit-behavior', use: {...shared, browserName: 'webkit'}},
  ],
});
