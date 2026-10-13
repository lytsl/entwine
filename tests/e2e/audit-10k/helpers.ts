import type { Browser, Page } from "@playwright/test";
import { expect } from "../helpers/test";
import type { Dataset } from "./seed";

export async function openMember(browser: Browser, data: Dataset, name: "ada" | "bob") {
  // Each context starts with empty app storage but reuses an API-created session, so cold-context repetitions
  // do not exceed production's three sign-ins per ten seconds.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "Asia/Kolkata",
    storageState: { cookies: data.sessions[name].cookies, origins: [] },
  });
  const signed = await context.request.get("http://localhost:3000/api/auth/get-session");
  expect(signed.ok()).toBe(true);
  expect((await signed.json()).user.id).toBe(data.members[name === "ada" ? 0 : 1]);
  return context.newPage();
}
export const allIssues = (data: Dataset) => `/${data.workspace.slug}/issues`;
export async function ready(page: Page) {
  await expect(page.getByTitle("10000 issues", { exact: true })).toBeVisible();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
}
