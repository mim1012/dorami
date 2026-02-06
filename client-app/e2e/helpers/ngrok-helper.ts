import { Page } from '@playwright/test';

/**
 * Handle ngrok's free plan warning page if it appears
 * ngrok shows a security warning (ERR_NGROK_6024) before allowing access
 */
export async function handleNgrokWarning(page: Page, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait a bit for the page to load
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      await page.waitForTimeout(1000); // Give page time to stabilize

      // Check if the page title indicates ngrok warning
      const title = await page.title();

      if (title.includes('ERR_NGROK') || title.includes('ngrok')) {
        console.log(`[Attempt ${attempt}/${maxRetries}] Detected ngrok warning page by title:`, title);

        // Try multiple selectors for the "Visit Site" button
        const selectors = [
          'button:has-text("Visit Site")',
          'button:has-text("visit site")',
          'a:has-text("Visit Site")',
          'a:has-text("visit site")',
          '[type="submit"]',
          'button[type="submit"]',
          'form button',
          '.btn',
          'button',
          'input[type="submit"]'
        ];

        for (const selector of selectors) {
          try {
            const button = page.locator(selector).first();
            const isVisible = await button.isVisible({ timeout: 3000 }).catch(() => false);

            if (isVisible) {
              console.log(`Found visit button with selector: ${selector}`);
              await button.click({ timeout: 5000 });
              console.log('Clicked visit button, waiting for navigation...');

              // Wait for navigation to complete - multiple strategies
              await Promise.race([
                page.waitForLoadState('networkidle', { timeout: 20000 }),
                page.waitForURL(/^((?!ERR_NGROK).)*$/, { timeout: 20000 })
              ]);
              await page.waitForTimeout(3000); // Extra wait for app to initialize

              // Verify we're past the warning
              const newTitle = await page.title();
              if (!newTitle.includes('ERR_NGROK')) {
                console.log('✅ Successfully bypassed ngrok warning, new title:', newTitle);
                return;
              } else {
                console.log(`Still on warning page, retrying... (${attempt}/${maxRetries})`);
                break; // Break inner loop to retry
              }
            }
          } catch (e) {
            // Try next selector
            continue;
          }
        }

        // If we're here and still on warning, retry
        if (attempt < maxRetries) {
          console.log(`Retrying in 2 seconds...`);
          await page.waitForTimeout(2000);
          await page.reload({ waitUntil: 'domcontentloaded' });
        }
      } else {
        console.log('No ngrok warning detected, page title:', title);
        return; // Success - no warning
      }
    } catch (error) {
      console.log(`Error in handleNgrokWarning (attempt ${attempt}):`, error);
      if (attempt === maxRetries) throw error;
    }
  }

  // Final check
  const finalTitle = await page.title();
  if (finalTitle.includes('ERR_NGROK')) {
    console.error('❌ Failed to bypass ngrok warning after all retries');
    throw new Error('Could not bypass ngrok warning page');
  }
}

/**
 * Navigate to a page and handle ngrok warning if present
 */
export async function gotoWithNgrokHandling(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await handleNgrokWarning(page);
}
