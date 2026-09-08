import {AxeBuilder} from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

const shells = ['default-shell', 'workbench-shell'] as const;
const states = ['loading', 'empty', 'ready', 'refreshing', 'error', 'permission-denied', 'offline', 'unsupported'] as const;
const viewports = {
  compact: {width: 390, height: 844}, medium: {width: 834, height: 1112}, expanded: {width: 1440, height: 900},
} as const;

test.beforeEach(async ({context}) => {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') await route.continue(); else await route.abort('blockedbyclient');
  });
});

for (const shell of shells) {
  test(`${shell} preserves route identity, navigation and overlay focus`, async ({page}) => {
    await page.setViewportSize(viewports.expanded);
    await page.goto(`/app?shell=${shell}`);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', {level: 1})).toBeFocused();
    await page.getByRole('link', {name: 'Projects', exact: true}).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/projects\\?shell=${shell}$`));
    await expect(page.getByRole('heading', {level: 1, name: 'Projects'})).toBeFocused();
    await expect(page.locator('[aria-live="polite"]')).toHaveText('Projects loaded');
    const trigger = page.getByRole('button', {name: /Commands/});
    await page.keyboard.press('ControlOrMeta+KeyK');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', {name: 'Close', exact: true}).click();
    await expect(trigger).toBeFocused();
  });

  test(`${shell} preserves deep-link identity through browser Back`, async ({page}) => {
    await page.goto(`/app/projects/alpha?shell=${shell}`);
    await expect(page.locator('.route-meta')).toContainText('project-detail');
    await page.getByRole('link', {name: 'Projects', exact: true}).first().click();
    await expect(page.locator('.route-meta')).toContainText('projects');
    await page.goBack();
    await expect(page.locator('.route-meta')).toContainText('project-detail');
    await expect(page.getByRole('heading', {level: 1, name: 'Project detail'})).toBeFocused();
  });

  test(`${shell} supports skip, command and directional keyboard flows`, async ({page, browserName}) => {
    await page.setViewportSize(viewports.expanded);
    await page.goto(`/app?shell=${shell}`);
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(page.getByRole('link', {name: 'Skip to main content'})).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    await page.keyboard.press('ControlOrMeta+KeyK');
    const commands = page.locator('.command-list button');
    await commands.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(commands.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(commands.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(commands.first()).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', {name: /Commands/})).toBeFocused();
  });

  test(`${shell} remains usable at 200% equivalent zoom, RTL and forced colors`, async ({page}) => {
    await page.emulateMedia({forcedColors: 'active', reducedMotion: 'reduce'});
    await page.setViewportSize({width: 720, height: 450});
    await page.goto(`/app?shell=${shell}`);
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
      const heading = document.querySelector<HTMLElement>('.state h2');
      if (heading) heading.textContent = 'A deliberately long localized project heading that must wrap without clipping';
    });
    await expect(page.locator('.state h2')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test(`${shell} compact primary touch targets remain at least 44 CSS pixels`, async ({page}) => {
    await page.setViewportSize(viewports.compact);
    await page.goto(`/app?shell=${shell}`);
    const targets = page.locator('button, .mobile-nav a');
    for (let index = 0; index < await targets.count(); index += 1) {
      const target = targets.nth(index);
      if (!(await target.isVisible())) continue;
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test(`${shell} local error preserves Shell, correlation and retry`, async ({page}) => {
    await page.goto(`/app?shell=${shell}&state=error`);
    await expect(page.locator(`[data-shell="${shell}"]`)).toBeVisible();
    await expect(page.locator('.route-meta')).toContainText('home');
    await expect(page.getByText('Reference UI-204')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Try again'})).toBeEnabled();
    await expect(page.getByRole('navigation').first()).toBeVisible();
  });

  if (shell === 'default-shell') test('default-shell medium drawer traps and restores focus', async ({page}) => {
    await page.setViewportSize(viewports.medium);
    await page.goto('/app?shell=default-shell');
    const trigger = page.getByRole('button', {name: 'Open navigation'});
    await trigger.click();
    await expect(page.getByRole('dialog', {name: 'Workspace navigation'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });

  for (const [viewportClass, viewport] of Object.entries(viewports)) {
    for (const state of states) {
      test(`${shell} ${viewportClass} ${state} has complete semantics and zero axe findings`, async ({page}) => {
        await page.setViewportSize(viewport);
        await page.goto(`/app?shell=${shell}&state=${state}`);
        await expect(page.locator(`[data-shell="${shell}"]`)).toBeVisible();
        await expect(page.locator(`.state-${state}`)).toBeVisible();
        await expect(page.getByRole('main')).toHaveCount(1);
        await expect(page.getByRole('heading', {level: 1})).toHaveText('Overview');
        const report = await new AxeBuilder({page}).withTags([
          'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa',
        ]).analyze();
        expect(report.violations, JSON.stringify(report.violations, null, 2)).toEqual([]);
        expect(report.incomplete, JSON.stringify(report.incomplete, null, 2)).toEqual([]);
      });
    }
  }

  test(`${shell} responsive boundaries preserve the active route`, async ({page}) => {
    await page.goto(`/app/projects/alpha?shell=${shell}`);
    for (const width of [767, 768, 1023, 1024]) {
      await page.setViewportSize({width, height: 900});
      await expect(page.locator('.route-meta')).toContainText('project-detail');
    }
  });
}

test.describe('canonical Chromium visuals', () => {
  test.skip(({browserName}) => browserName !== 'chromium');
  for (const shell of shells) {
    for (const [viewportClass, viewport] of Object.entries(viewports)) {
      for (const colorScheme of ['light', 'dark'] as const) {
        test(`${shell} ${viewportClass} ${colorScheme} ready visual`, async ({page}) => {
          await page.emulateMedia({colorScheme, reducedMotion: 'reduce'});
          await page.setViewportSize(viewport);
          await page.goto(`/app?shell=${shell}&state=ready`);
          await page.evaluate(() => document.fonts.ready);
          await expect(page).toHaveScreenshot(`${shell}-home-ready-${viewportClass}-${colorScheme}.png`);
        });
      }
    }
    for (const state of ['loading', 'error', 'permission-denied', 'offline'] as const) {
      test(`${shell} compact ${state} visual`, async ({page}) => {
        await page.emulateMedia({colorScheme: 'light', reducedMotion: 'reduce'});
        await page.setViewportSize(viewports.compact);
        await page.goto(`/app?shell=${shell}&state=${state}`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${shell}-home-${state}-compact-light.png`);
      });
    }
  }
});
