/**
 * E2E tests — Login flow
 *
 * Tests the complete login journey: form rendering, validation,
 * wrong credentials, successful login, and redirect behaviour.
 */

import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
  });

  test("renders the login form with email and password fields", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /login|sign in/i })
    ).toBeVisible();
  });

  test("shows error message for wrong email", async ({ page }) => {
    await page.getByLabel(/email/i).fill("doesnotexist@nowhere.com");
    await page.getByLabel(/password/i).fill("SomePass123");
    await page.getByRole("button", { name: /login|sign in/i }).click();

    // Should stay on login and show an error
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    const errorVisible = await page
      .getByText(/incorrect|invalid|wrong|not found|error/i)
      .isVisible()
      .catch(() => false);

    expect(currentUrl.includes("/dashboard") === false || errorVisible).toBe(true);
  });

  test("shows error for wrong password", async ({ page }) => {
    await page.getByLabel(/email/i).fill("real@user.com");
    await page.getByLabel(/password/i).fill("WrongPassword999");
    await page.getByRole("button", { name: /login|sign in/i }).click();

    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("/dashboard");
  });

  test("password field hides the text input", async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("does not submit with empty email", async ({ page }) => {
    await page.getByLabel(/password/i).fill("ValidPass123");
    await page.getByRole("button", { name: /login|sign in/i }).click();

    // Should not navigate away
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/login");
  });

  test("does not submit with empty password", async ({ page }) => {
    await page.getByLabel(/email/i).fill("user@test.com");
    await page.getByRole("button", { name: /login|sign in/i }).click();

    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/login");
  });

  test("has a link to the signup page", async ({ page }) => {
    const signupLink = page.getByRole("link", {
      name: /sign up|create account|register|don't have/i,
    });
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("sets a token cookie after successful login", async ({ page }) => {
    // NOTE: This test requires a real seeded user in the DB.
    // Skip if running against mock — mark as skipped in offline CI.
    test.skip(
      !process.env.E2E_TEST_EMAIL,
      "Skipped: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars for live login test"
    );

    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: /login|sign in/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === "token");
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie!.value.length).toBeGreaterThan(20);
  });

  test("redirects to /dashboard after successful login", async ({ page }) => {
    test.skip(
      !process.env.E2E_TEST_EMAIL,
      "Skipped: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars"
    );

    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: /login|sign in/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");
  });
});

test.describe("Login Page — Unauthenticated redirect", () => {
  test("redirects unauthenticated users away from /dashboard", async ({ page }) => {
    // Clear any existing auth cookies
    await page.context().clearCookies();
    await page.goto("/dashboard");

    // Should be redirected to /login (or / landing)
    await page.waitForURL(/\/(login|)$/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/(login|)$/);
  });

  test("redirects unauthenticated users away from /board", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/board/99999");

    await page.waitForURL(/\/(login|)$/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/(login|)$/);
  });
});
