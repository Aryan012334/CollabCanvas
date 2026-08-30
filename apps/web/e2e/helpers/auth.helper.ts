/**
 * Reusable auth helpers for Playwright tests.
 * Centralises login/signup so individual tests stay clean.
 */

import { Page, expect } from "@playwright/test";

export const TEST_USER = {
  name: "QA Test User",
  email: `qa_${Date.now()}@collabdraw-test.com`,
  password: "TestPass123!",
};

/**
 * Navigates to /signup and fills in the form.
 * Returns the email used (useful when auto-generating unique emails).
 */
export async function signupUser(
  page: Page,
  user: { name: string; email: string; password: string } = TEST_USER
) {
  await page.goto("/signup");
  await page.waitForLoadState("networkidle");

  await page.getByLabel(/name/i).fill(user.name);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign up|create account|register/i }).click();

  return user;
}

/**
 * Navigates to /login and submits credentials.
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /login|sign in/i }).click();
}

/**
 * Injects a JWT cookie directly — skips the UI login for tests
 * that just need an authenticated state without testing login itself.
 */
export async function injectAuthCookie(page: Page, token: string) {
  await page.context().addCookies([
    {
      name: "token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
    },
  ]);
}

/**
 * Clears all cookies and local storage to simulate a logged-out state.
 */
export async function logout(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}
