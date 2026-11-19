import { test, expect } from '@playwright/test';

test.describe('Shopping List App - enkel navigation', () => {
  const BASE_URL = 'http://localhost:5182';

  test('gå till register-sidan', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('text=Skapa konto')).toBeVisible();
    
    // Klicka på "Skapa konto" (den blåa knappen)
    await page.click('text=Skapa konto');
    
    // Verifiera att vi är på register-sidan
    await expect(page.locator('input[placeholder="E-post"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder="Lösenord"]')).toBeVisible();
    
    console.log('✅ Kom till register-sidan');
  });

  test('registrera och logga in', async ({ page }) => {
    const timestamp = Date.now();
    const email = `e2e-playwright-${timestamp}@example.com`;

    await page.goto(BASE_URL);
    await page.click('text=Skapa konto');
    await expect(page.locator('input[placeholder="E-post"]')).toBeVisible();
    
    await page.fill('input[placeholder="E-post"]', email);
    await page.fill('input[placeholder="Lösenord"]', 'test123');
    await page.click('button[type="submit"]');

    // Vänta på API-svaret från registreringen
    const regResponse = await page.waitForResponse(response => response.url().includes('/api/auth/register') && response.status() === 200);
    console.log('Registrerings-svar:', regResponse.status());

    // Vänta på att listor-sidan visas (React state byter view, URL förblir oförändrad)
    await expect(page.locator('text=Ny lista')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Ny lista')).toBeVisible();
    
    console.log('✅ Registrering och navigering till listor-sidan fungerar');
  });
});
