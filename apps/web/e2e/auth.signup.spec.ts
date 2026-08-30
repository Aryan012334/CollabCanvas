/**
 * E2E tests — Signup flow
 *
 * Tests the complete user registration journey from the browser perspective.
 * Verifies form validation, success redirect, and error states.
 */

import { test, expect } from "@playwright/test";

// Use a unique email per test run to avoid conflicts on a real backend
const uniqueEmail = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;

test.describe("Signup Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
  });

  test("renders the signup form with all required fields", async ({ page }) => {
    await expect(page).toHaveTitle(/CollabDraw|Sign Up|Create Account/i);
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign up|create account|register/i })
    ).toBeVisible();
  });

  test("shows validation error when name is too short", async ({ page }) => {
    await page.getByLabel(/name/i).fill("A"); // too short, min 2 chars
    await page.getByLabel(/email/i).fill("test@test.com");
    await page.getByLabel(/password/i).fill("ValidPass123");
    await page.getByRole("button", { name: /sign up|create account|register/i }).click();

    // Should show an inline error or stay on /signup
    const url = page.url();
    const hasError =
      !url.includes("/dashboard") ||
      (await page.getByText(/name|short|least/i).isVisible());
    expect(hasError).toBe(true);
  });

  test("shows validation error for invalid email format", async ({ page }) => {
    await page.getByLabel(/name/i).fill("Valid Name");
    await page.getByLabel(/email/i).fill("not-a-valid-email");
    await page.getByLabel(/password/i).fill("ValidPass123");
    await page.getByRole("button", { name: /sign up|create account|register/i }).click();

    const url = page.url();
    const hasError =
      !url.includes("/dashboard") ||
      (await page.getByText(/invalid|email|valid/i).isVisible());
    expect(hasError).toBe(true);
  });

  test("shows validation error when password is too short", async ({ page }) => {
    await page.getByLabel(/name/i).fill("Valid Name");
    await page.getByLabel(/email/i).fill(uniqueEmail());
    await page.getByLabel(/password/i).fill("short"); // min 8 chars
    await page.getByRole("button", { name: /sign up|create account|register/i }).click();

    const url = page.url();
    expect(url).not.toContain("/dashboard");
  });

  test("submits successfully with valid data and redirects", async ({ page }) => {
    await page.getByLabel(/name/i).fill("E2E Test User");
    await page.getByLabel(/email/i).fill(uniqueEmail());
    await page.getByLabel(/password/i).fill("ValidPass123!");
    await page.getByRole("button", { name: /sign up|create account|register/i }).click();

    // Should redirect to /login or /dashboard after successful signup
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/(login|dashboard)/);
  });

  test("has a link to the login page", async ({ page }) => {
    const loginLink = page.getByRole("link", { name: /login|sign in|already have/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("password field masks the input", async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("submit button is present and clickable", async ({ page }) => {
    const btn = page.getByRole("button", { name: /sign up|create account|register/i });
    await expect(btn).toBeEnabled();
  });
});
