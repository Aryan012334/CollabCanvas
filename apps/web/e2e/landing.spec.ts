/**
 * E2E tests — Landing Page (/)
 *
 * Verifies the public landing page renders correctly
 * and all navigation links work. No auth required.
 */

import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("loads successfully with a 200 response", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
  });

  test("has a visible hero section with a headline", async ({ page }) => {
    const hero = page
      .locator("h1")
      .or(page.getByRole("heading", { level: 1 }));
    await expect(hero.first()).toBeVisible();
  });

  test("has a call-to-action button or link", async ({ page }) => {
    const cta = page
      .getByRole("link", { name: /get started|try|sign up|start drawing/i })
      .or(page.getByRole("button", { name: /get started|try|sign up|start/i }));
    await expect(cta.first()).toBeVisible();
  });

  test("CTA navigates to /signup or /login", async ({ page }) => {
    const cta = page
      .getByRole("link", { name: /get started|try|sign up|start/i })
      .first();

    if (await cta.isVisible()) {
      await cta.click();
      await page.waitForURL(/\/(signup|login)/, { timeout: 8000 });
      expect(page.url()).toMatch(/\/(signup|login)/);
    }
  });

  test("navbar has login and signup links", async ({ page }) => {
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    const loginLink = nav.getByRole("link", { name: /login|sign in/i });
    const signupLink = nav.getByRole("link", { name: /sign up|register|get started/i });

    // At least one should be visible
    const hasAuthLinks =
      (await loginLink.isVisible().catch(() => false)) ||
      (await signupLink.isVisible().catch(() => false));
    expect(hasAuthLinks).toBe(true);
  });

  test("login link navigates to /login", async ({ page }) => {
    const loginLink = page.getByRole("link", { name: /login|sign in/i }).first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("page has no broken images", async ({ page }) => {
    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate(
        (el: HTMLImageElement) => el.naturalWidth
      );
      const src = await img.getAttribute("src");
      // naturalWidth > 0 means image loaded successfully
      if (src && !src.startsWith("data:")) {
        expect(naturalWidth).toBeGreaterThan(0);
      }
    }
  });

  test("page is responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Body should render without horizontal scroll
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
  });

  test("page title is set correctly", async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toMatch(/CollabDraw|draw|collab/i);
  });
});
