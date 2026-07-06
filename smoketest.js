const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (msg) => {
    console.log('[browser console.'+msg.type()+']', msg.text());
    if (msg.type() === 'error') errors.push('CONSOLE.ERROR: ' + msg.text());
  });
  page.on('requestfailed', (req) => {
    errors.push('REQUEST FAILED: ' + req.url() + ' -> ' + (req.failure()?.errorText || ''));
  });

  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  console.log('EARLY ERRORS:', JSON.stringify(errors, null, 2));
  console.log('hash right after load:', await page.evaluate(() => location.hash));

  // Click "Get started"
  await page.click('[data-nav="auth"]');
  await page.waitForTimeout(300);
  console.log('hash after clicking get started:', await page.evaluate(() => location.hash));
  console.log('active view id:', await page.evaluate(() => document.querySelector('.view.is-active')?.id));
  console.log('btn-guest visible?', await page.isVisible('#btn-guest'));

  // Continue as guest
  await page.click('#btn-guest');
  await page.waitForTimeout(500);

  // Should now be on onboarding. Fill it out.
  const url1 = await page.evaluate(() => location.hash);
  console.log('After guest click, hash =', url1);

  // welcome step -> continue
  await page.click('#ob-next');
  await page.waitForTimeout(150);
  // profile step
  await page.fill('#ob-name', 'Asha');
  await page.click('[data-choice-group="board"] [data-value="CBSE"]');
  await page.click('#ob-next');
  await page.waitForTimeout(150);
  // subjects step
  await page.fill('#ob-subject-input', 'Mathematics');
  await page.click('#ob-add-subject');
  await page.fill('#ob-subject-input', 'Physics');
  await page.click('#ob-add-subject');
  await page.click('#ob-next');
  await page.waitForTimeout(150);
  // study habits
  await page.click('[data-choice-group="preferredTime"] [data-value="Evening"]');
  await page.click('[data-choice-group="sessionLength"] [data-value="45"]');
  await page.click('#ob-next');
  await page.waitForTimeout(150);
  // learning style
  await page.click('[data-choice-group="learningStyle"] [data-value="Mixed"]');
  await page.click('#ob-next');
  await page.waitForTimeout(150);
  // review -> finish
  await page.click('#ob-next');
  await page.waitForTimeout(400);

  const hash2 = await page.evaluate(() => location.hash);
  console.log('After onboarding finish, hash =', hash2);

  // Should now be on checkin
  await page.fill('#ci-exam', '20');
  await page.fill('#ci-assignments', '2');
  await page.fill('#ci-sleep', '6');
  await page.fill('#ci-phone', '3');
  await page.fill('#ci-freetime', '4');
  await page.click('#ci-submit');
  await page.waitForTimeout(500);

  const hash3 = await page.evaluate(() => location.hash);
  console.log('After checkin submit, hash =', hash3);

  // Dashboard checks
  const dashText = await page.textContent('#dash-greeting');
  console.log('Dashboard greeting:', dashText);

  // Navigate to timetable via bottom nav
  await page.click('.nav-item[data-route="timetable"]');
  await page.waitForTimeout(300);
  const sessionCount = await page.$$eval('.session', (els) => els.length);
  console.log('Timetable session blocks rendered:', sessionCount);

  // Complete first study session
  const completeBtn = await page.$('[data-action="complete"]');
  if (completeBtn) {
    await completeBtn.click();
    await page.waitForTimeout(200);
  }

  // Navigate to insights
  await page.click('.nav-item[data-route="insights"]');
  await page.waitForTimeout(300);
  const heatmapCells = await page.$$eval('#ins-heatmap .star', (els) => els.length);
  console.log('Heatmap cells:', heatmapCells);

  // Navigate to weekly report
  await page.click('.nav-item[data-route="weekly-report"]');
  await page.waitForTimeout(300);
  const wrScore = await page.textContent('#wr-score');
  console.log('Weekly report score:', wrScore);

  // Navigate to settings, toggle theme + accent
  await page.click('.nav-item[data-route="settings"]');
  await page.waitForTimeout(200);
  await page.selectOption('#set-theme', 'light');
  await page.click('[data-accent="purple"]');
  await page.waitForTimeout(200);
  const bodyAccent = await page.evaluate(() => document.body.getAttribute('data-accent'));
  console.log('Body accent after switch:', bodyAccent);

  // Reload to test session restoration + offline resilience
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const hashAfterReload = await page.evaluate(() => location.hash);
  console.log('Hash after reload (session restored):', hashAfterReload);

  await browser.close();

  console.log('\n--- ERRORS CAPTURED:', errors.length, '---');
  errors.forEach((e) => console.log(e));
  process.exit(errors.length ? 1 : 0);
})().catch(async (e) => {
  console.log('TEST THREW:', e.message);
  process.exit(1);
});
