const { _electron } = require('playwright');
const fs = require('fs');
const path = require('path');

const stage = process.argv[2] || 'before';
const outDir = path.resolve(__dirname, `../screenshots/${stage}`);
fs.mkdirSync(outDir, { recursive: true });

async function getMainWindow(app) {
  for (let i = 0; i < 30; i++) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (!url.includes('splash') && !win.isClosed()) {
          const title = await win.title();
          if (title === 'OS11' || url.includes('index.html')) {
            return win;
          }
        }
      } catch {
        // window might be closing
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  // Fallback to first available non-splash window
  for (const win of app.windows()) {
    if (!win.url().includes('splash')) return win;
  }
  return app.firstWindow();
}

async function run() {
  console.log(`Starting screenshot capture for stage: ${stage}...`);
  const app = await _electron.launch({ args: ['.'], timeout: 30000 });

  // Wait 3.5s for splash screen to disappear and main window to focus
  await new Promise((r) => setTimeout(r, 3500));

  const win = await getMainWindow(app);
  console.log('Main window resolved:', await win.title());
  await win.waitForTimeout(1500);

  // Helper to set theme
  async function setTheme(theme) {
    await win.evaluate((t) => {
      if (t === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }, theme);
    await win.waitForTimeout(300);
  }

  // Helper to capture a named view in light and dark
  async function captureView(viewName) {
    // Light
    await setTheme('light');
    const lightPath = path.join(outDir, `${viewName}-light.png`);
    await win.screenshot({ path: lightPath });
    console.log(`Saved: ${viewName}-light.png`);

    // Dark
    await setTheme('dark');
    const darkPath = path.join(outDir, `${viewName}-dark.png`);
    await win.screenshot({ path: darkPath });
    console.log(`Saved: ${viewName}-dark.png`);
  }

  // Helper to click sidebar item by text match
  async function clickSidebarItem(regex) {
    const clicked = await win.evaluate((pattern) => {
      const reg = new RegExp(pattern, 'i');
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      for (const btn of buttons) {
        if (reg.test(btn.textContent || '') || reg.test(btn.getAttribute('aria-label') || '')) {
          btn.click();
          return true;
        }
      }
      return false;
    }, regex);
    await win.waitForTimeout(1000);
    return clicked;
  }

  // 1. My Day
  await clickSidebarItem('My Day');
  await captureView('my-day');

  // 2. Inbox
  await clickSidebarItem('Inbox');
  await captureView('inbox');

  // 3. Planned
  await clickSidebarItem('Planned');
  await captureView('planned');

  // 4. Anytime
  await clickSidebarItem('Anytime');
  await captureView('anytime');

  // 5. Someday
  await clickSidebarItem('Someday');
  await captureView('someday');

  // 6. Project (click project in sidebar or open project)
  const clickedProject = await win.evaluate(() => {
    const items = Array.from(document.querySelectorAll('button, div[role="button"]'));
    for (const el of items) {
      const aria = el.getAttribute('aria-label') || '';
      const text = el.textContent || '';
      if (aria.toLowerCase().includes('project') || text.includes('📁') || text.includes('OS11') || text.includes('Project')) {
        if (!/all projects|new project/i.test(text)) {
          el.click();
          return text.trim();
        }
      }
    }
    return null;
  });
  console.log(`Project clicked: ${clickedProject}`);
  await win.waitForTimeout(1000);
  await captureView('project');

  // 7. Area (first available area header or area view)
  const clickedArea = await win.evaluate(() => {
    const areaButtons = Array.from(document.querySelectorAll('[aria-label^="Area "]'));
    if (areaButtons.length > 0) {
      areaButtons[0].click();
      return areaButtons[0].getAttribute('aria-label');
    }
    return null;
  });
  console.log(`Area clicked: ${clickedArea}`);
  await win.waitForTimeout(1000);
  await captureView('area');

  // 8. Tag view (click a tag or open tag view)
  const clickedTag = await win.evaluate(() => {
    const tagElements = Array.from(document.querySelectorAll('button, span, div[role="button"]')).filter((el) => {
      const txt = (el.textContent || '').trim();
      return txt.startsWith('#') && txt.length > 1;
    });
    if (tagElements.length > 0) {
      tagElements[0].click();
      return tagElements[0].textContent;
    }
    return null;
  });
  console.log(`Tag clicked: ${clickedTag}`);
  await win.waitForTimeout(1000);
  await captureView('tag');

  console.log('All screenshots captured successfully!');
  try {
    await app.close();
  } catch {
    // ignore
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Error taking screenshots:', err);
  process.exit(1);
});
