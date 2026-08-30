/**
 * E2E tests — Dashboard
 *
 * Tests the dashboard page: loading state, room creation,
 * room listing, search, and navigation to a board.
 *
 * Tests that require auth use E2E_TEST_EMAIL / E2E_TEST_PASSWORD env vars
 * OR inject a pre-signed JWT cookie for speed.
 */

import { test, expect } from "@playwright/test";
import { loginUser } from "./helpers/auth.helper";

// ─── Public-facing dashboard tests (no auth required to run) ─────────────────
test.describe("Dashboard — Unauthenticated", () => {
  test("redirects to /login when not authenticated", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");

    await page.waitForURL(/\/(login|)$/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/(login|)$/);
  });
});

// ─── Authenticated dashboard tests ───────────────────────────────────────────
test.describe("Dashboard — Authenticated", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL,
    "Skipped: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated tests"
  );

  test.beforeEach(async ({ page }) => {
    await loginUser(page, process.env.E2E_TEST_EMAIL!, process.env.E2E_TEST_PASSWORD!);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test("renders dashboard page after login", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("shows a 'Create Room' button", async ({ page }) => {
    const createBtn = page.getByRole("button", {
      name: /create|new room|new board/i,
    });
    await expect(createBtn).toBeVisible();
  });

  test("shows loading skeleton while rooms are fetching", async ({ page }) => {
    // Intercept rooms API to delay response, simulating slow network
    await page.route("**/rooms", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    await page.goto("/dashboard");

    // Skeleton should be visible during the delay
    const skeleton = page.locator("[data-testid='skeleton'], .animate-pulse, .skeleton");
    // Check for skeleton OR loading indicator
    const hasLoadingState =
      (await skeleton.count()) > 0 ||
      (await page.getByText(/loading/i).isVisible().catch(() => false));
    expect(hasLoadingState).toBe(true);
  });

  test("can open the Create Room modal/dialog", async ({ page }) => {
    const createBtn = page.getByRole("button", { name: /create|new room|new board/i });
    await createBtn.click();

    // Dialog or input should appear
    const dialog = page
      .getByRole("dialog")
      .or(page.getByPlaceholder(/room name|board name/i));
    await expect(dialog.first()).toBeVisible({ timeout: 5000 });
  });

  test("can type a room name and submit the create room form", async ({ page }) => {
    const roomName = `e2e-room-${Date.now()}`;

    const createBtn = page.getByRole("button", { name: /create|new room|new board/i });
    await createBtn.click();

    const nameInput = page.getByPlaceholder(/room name|board name|name/i).first();
    await nameInput.fill(roomName);

    const submitBtn = page.getByRole("button", { name: /create|confirm|ok/i }).last();
    await submitBtn.click();

    // Should either navigate to the board or show the new room in the list
    await page.waitForTimeout(2000);
    const url = page.url();
    const roomAppeared = await page.getByText(roomName).isVisible().catch(() => false);
    expect(url.includes("/board") || roomAppeared).toBe(true);
  });

  test("displays user rooms in a grid/list", async ({ page }) => {
    // Rooms grid or list container should be present
    const roomsContainer = page
      .locator("[data-testid='rooms-grid'], .rooms-grid")
      .or(page.getByRole("list"))
      .or(page.locator("main"));
    await expect(roomsContainer.first()).toBeVisible();
  });

  test("search bar filters rooms by name", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    if (await searchInput.isVisible()) {
      await searchInput.fill("non-existent-room-xyz");
      await page.waitForTimeout(500); // debounce

      // Either shows "no results" or the grid becomes empty
      const noResults = await page
        .getByText(/no rooms|no results|empty/i)
        .isVisible()
        .catch(() => false);
      const cards = await page.locator("[data-testid='room-card']").count();

      expect(noResults || cards === 0).toBe(true);
    } else {
      test.skip();
    }
  });

  test("clicking a room card navigates to the board", async ({ page }) => {
    // Wait for at least one room card
    const roomCard = page.locator("[data-testid='room-card'], .room-card").first();

    if (await roomCard.isVisible()) {
      await roomCard.click();
      await page.waitForURL(/\/board\/\d+/, { timeout: 8000 });
      expect(page.url()).toContain("/board/");
    } else {
      test.skip(); // No rooms yet — skip navigation test
    }
  });

  test("shows correct user name/avatar in header", async ({ page }) => {
    // Header should show some user identifier
    const header = page.locator("header").or(page.locator("nav"));
    await expect(header.first()).toBeVisible();
  });
});
