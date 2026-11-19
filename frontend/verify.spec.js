// E2E-tester för shopping-list-appen med Playwright
// Kör med: npx playwright test verify.spec.js

import { test, expect } from '@playwright/test';

test.describe('Shopping List App', () => {
  test.use({ navigationTimeout: 30000, actionTimeout: 30000 });
  const BASE_URL = 'http://localhost:5182';

  test('1. hela flödet: registrera, logga in, skapa lista, lägg till vara, kryssa av', async ({ page }) => {
    const timestamp = Date.now();
    const email = `e2e-playwright-${timestamp}@example.com`;

    page.on('console', msg => console.log('PAGE:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    await expect(page).toHaveTitle(/The List/);
    await expect(page.locator('text=The List')).toBeVisible();
    await expect(page.locator('text=Skapa konto')).toBeVisible();
    await expect(page.locator('text=Jag har redan ett konto')).toBeVisible();

    // Klicka på "Skapa konto" för att gå till register-sidan
    await page.click('text=Skapa konto');
    await expect(page.locator('input[placeholder="E-post"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Lösenord"]')).toBeVisible();
    await expect(page.locator('text=Skapa konto')).toBeVisible(); // submit-knappen

    // Fyll i registreringsformuläret
    await page.fill('input[placeholder="Användarnamn"]', email);
    await page.fill('input[placeholder="För- och efternamn"]', 'Test Användare');
    await page.fill('input[placeholder="E-post"]', email);
    await page.fill('input[placeholder="Lösenord"]', 'test123');

    // Klicka på "Skapa konto"-knappen (submit)
    await page.click('button[type="submit"]');

    // Vänta på att listor-sidan visas (React state byter view, URL förblir oförändrad)
    await expect(page.locator('input[placeholder="Ny lista"]')).toBeVisible({ timeout: 15000 });

    // Skapa en lista
    await page.fill('input[placeholder="Ny lista"]', 'E2E-testlista');
    await page.press('input[placeholder="Ny lista"]', 'Enter');

    // Verifiera att listan visas
    await expect(page.locator('text=E2E-testlista')).toBeVisible();

    // Gå in i listan
    await page.evaluate(() => {
      const lis = document.querySelectorAll('li');
      for (const li of lis) {
        if (li.textContent.includes('E2E-testlista')) {
          li.click();
          break;
        }
      }
    });
    await page.waitForTimeout(500);
    await expect(page.locator('input[placeholder="Lägg till en uppgift"]')).toBeVisible({ timeout: 10000 });

    // Lägg till en vara
    await page.fill('input[placeholder="Lägg till en uppgift"]', 'Mjölk');
    await page.click('button[type="button"]:has-text("+")'); // plus-knappen bredvid input
    await expect(page.locator('text=Mjölk')).toBeVisible();

    // Gå tillbaka till listor och verifiera att item_count = 1
    await page.click('button:has-text("<")');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=1 uppgift')).toBeVisible();

    // Gå tillbaka in i listan och lägg till ytterligare en vara
    await page.evaluate(() => {
      const lis = document.querySelectorAll('li');
      for (const li of lis) {
        if (li.textContent.includes('E2E-testlista')) {
          li.click();
          break;
        }
      }
    });
    await page.waitForTimeout(500);
    await page.fill('input[placeholder="Lägg till en uppgift"]', 'Bröd');
    await page.click('button[type="button"]:has-text("+")');
    await expect(page.locator('text=Bröd')).toBeVisible();

    // Gå tillbaka till listor och verifiera att item_count = 2
    await page.click('button:has-text("<")');
    await expect(page.locator('text=2 uppgifter')).toBeVisible();

    // Gå tillbaka in i listan och kryssa av första varan
    await page.evaluate(() => {
      const lis = document.querySelectorAll('li');
      for (const li of lis) {
        if (li.textContent.includes('E2E-testlista')) {
          li.click();
          break;
        }
      }
    });
    await page.waitForTimeout(1000);
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Slutfört')).toBeVisible();

    // Gå tillbaka till listor och verifiera att item_count = 1 (en vara kvar efter att en blev avbockad)
    await page.click('button:has-text("<")');
    await expect(page.locator('text=1 uppgift')).toBeVisible();

    console.log('✅ TEST 1 GENOMFÖRT UTAN FEL');
  });

  test('2. logga ut och landa på startsidan', async ({ page }) => {
    const timestamp = Date.now();

    page.on('console', msg => console.log('PAGE:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    // Registrera en ny användare
    await page.click('text=Skapa konto');
    await page.fill('input[placeholder="Användarnamn"]', 'logout-test-' + timestamp + '@example.com');
    await page.fill('input[placeholder="För- och efternamn"]', 'Logout Test');
    await page.fill('input[placeholder="E-post"]', 'logout-test-' + timestamp + '@example.com');
    await page.fill('input[placeholder="Lösenord"]', 'test123');
    await page.click('button[type="submit"]');
    await expect(page.locator('input[placeholder="Ny lista"]')).toBeVisible({ timeout: 15000 });

    // Klicka på cirkel-avataren för att öppna användarmenyn
    await page.locator('header .border-indigo-600').click();

    // Klicka på "Logga ut"
    await page.click('text=Logga ut');

    // Verifiera att vi hamnar på startsidan
    await expect(page.locator('text=Skapa konto')).toBeVisible();
    await expect(page.locator('text=Jag har redan ett konto')).toBeVisible();
    await expect(page.locator('input[placeholder="Ny lista"]')).not.toBeVisible();

    console.log('✅ TEST 2 GENOMFÖRT UTAN FEL');
  });

  test('3. dela lista mellan två användare', async ({ browser }) => {
    const timestamp = Date.now();
    const emailA = `usera-${timestamp}@example.com`;
    const emailB = `userb-${timestamp}@example.com`;

    // === Användare A skapar konto och listan ===
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    pageA.on('console', msg => console.log('PAGE A:', msg.text()));
    pageA.on('pageerror', err => console.log('PAGE A ERROR:', err.message));

    await pageA.goto(BASE_URL);
    await pageA.waitForTimeout(3000);
    await pageA.click('text=Skapa konto');
    await pageA.fill('input[placeholder="Användarnamn"]', emailA);
    await pageA.fill('input[placeholder="För- och efternamn"]', 'Användare A');
    await pageA.fill('input[placeholder="E-post"]', emailA);
    await pageA.fill('input[placeholder="Lösenord"]', 'test123');
    await pageA.click('button[type="submit"]');
    await expect(pageA.locator('input[placeholder="Ny lista"]')).toBeVisible({ timeout: 15000 });

    await pageA.fill('input[placeholder="Ny lista"]', 'Delad lista');
    await pageA.press('input[placeholder="Ny lista"]', 'Enter');
    await expect(pageA.locator('text=Delad lista')).toBeVisible();

    // User A går in i listan och lägger till Mjölk
    await pageA.evaluate(() => {
      const lis = document.querySelectorAll('li');
      for (const li of lis) {
        if (li.textContent.includes('Delad lista')) {
          li.click();
          break;
        }
      }
    });
    await pageA.waitForTimeout(500);
    await expect(pageA.locator('input[placeholder="Lägg till en uppgift"]')).toBeVisible({ timeout: 10000 });
    await pageA.fill('input[placeholder="Lägg till en uppgift"]', 'Mjölk');
    await pageA.click('button[type="button"]:has-text("+")');
    await expect(pageA.locator('text=Mjölk')).toBeVisible();

    // === User B skapar konto (måste finnas innan inbjudan) ===
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    pageB.on('console', msg => console.log('PAGE B:', msg.text()));
    pageB.on('pageerror', err => console.log('PAGE B ERROR:', err.message));

    await pageB.goto(BASE_URL);
    await pageB.waitForTimeout(3000);
    await pageB.click('text=Skapa konto');
    await pageB.fill('input[placeholder="Användarnamn"]', emailB);
    await pageB.fill('input[placeholder="För- och efternamn"]', 'Användare B');
    await pageB.fill('input[placeholder="E-post"]', emailB);
    await pageB.fill('input[placeholder="Lösenord"]', 'test123');
    await pageB.click('button[type="submit"]');
    await expect(pageB.locator('input[placeholder="Ny lista"]')).toBeVisible({ timeout: 15000 });

    // User A bjuder in User B
    await pageA.click('button svg');
    await pageA.fill('input[placeholder="Användarnamn"]', emailB);
    await pageA.waitForTimeout(1000);
    await pageA.click('button:has-text("Skicka")');
    await pageA.waitForTimeout(500);

    // User B laddar om för att se den delade listan
    await pageB.reload();
    await pageB.waitForTimeout(3000);

    // User B ser den delade listan
    await expect(pageB.locator('text=Delad lista')).toBeVisible({ timeout: 10000 });

    // User B går in i listan och ser Mjölk
    await pageB.evaluate(() => {
      const lis = document.querySelectorAll('li');
      for (const li of lis) {
        if (li.textContent.includes('Delad lista')) {
          li.click();
          break;
        }
      }
    });
    await pageB.waitForTimeout(500);
    await expect(pageB.locator('input[placeholder="Lägg till en uppgift"]')).toBeVisible({ timeout: 10000 });
    await expect(pageB.locator('text=Mjölk')).toBeVisible();

    // User B lägger till Bröd
    await pageB.fill('input[placeholder="Lägg till en uppgift"]', 'Bröd');
    await pageB.click('button[type="button"]:has-text("+")');
    await expect(pageB.locator('text=Bröd')).toBeVisible();

    // User A ser Bröd i sin lista
    await pageA.click('button:has-text("<")');
    await pageA.waitForTimeout(500);
    await pageA.evaluate(() => {
      const lis = document.querySelectorAll('li');
      for (const li of lis) {
        if (li.textContent.includes('Delad lista')) {
          li.click();
          break;
        }
      }
    });
    await pageA.waitForTimeout(500);
    await expect(pageA.locator('text=Bröd')).toBeVisible();

    await contextA.close();
    await contextB.close();
    console.log('✅ TEST 3 GENOMFÖRT UTAN FEL');
  });

  test('4. kan inte bjuda in användare som inte finns - negativt test', async ({ browser }) => {
    const timestamp = Date.now();
    const emailA = `negusera-${timestamp}@example.com`;

    // === Användare A skapar konto och listan ===
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    pageA.on('console', msg => console.log('PAGE A:', msg.text()));
    pageA.on('pageerror', err => console.log('PAGE A ERROR:', err.message));

    await pageA.goto(BASE_URL);
    await pageA.waitForTimeout(3000);
    await pageA.click('text=Skapa konto');
    await pageA.fill('input[placeholder="Användarnamn"]', emailA);
    await pageA.fill('input[placeholder="För- och efternamn"]', 'Användare A');
    await pageA.fill('input[placeholder="E-post"]', emailA);
    await pageA.fill('input[placeholder="Lösenord"]', 'test123');
    await pageA.click('button[type="submit"]');
    await expect(pageA.locator('input[placeholder="Ny lista"]')).toBeVisible({ timeout: 15000 });

    await pageA.fill('input[placeholder="Ny lista"]', 'Negativtestlista');
    await pageA.press('input[placeholder="Ny lista"]', 'Enter');
    await expect(pageA.locator('text=Negativtestlista')).toBeVisible();

    // User A går in i listan
    await pageA.evaluate(() => {
      const lis = document.querySelectorAll('li');
      for (const li of lis) {
        if (li.textContent.includes('Negativtestlista')) {
          li.click();
          break;
        }
      }
    });
    await pageA.waitForTimeout(500);
    await expect(pageA.locator('input[placeholder="Lägg till en uppgift"]')).toBeVisible({ timeout: 10000 });

    // User A öppnar inbjudningsmodalen och skriver ett icke-existerande användarnamn
    await pageA.click('button svg');
    await pageA.fill('input[placeholder="Användarnamn"]', 'nonexistentuser123');
    await pageA.waitForTimeout(1500);

    // Röd bock ska visas (användaren finns inte)
    await expect(pageA.locator('.text-red-500')).toBeVisible();

    // Klicka på Skicka -> felmeddelande ska visas
    await pageA.click('button:has-text("Skicka")');
    await pageA.waitForTimeout(500);

    // Felmeddelande ska synas
    await expect(pageA.locator('text=Användaren finns inte')).toBeVisible();

    await contextA.close();
    console.log('✅ TEST 4 GENOMFÖRT UTAN FEL');
  });
});
