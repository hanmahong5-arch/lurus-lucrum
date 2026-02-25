/**
 * Zitadel OIDC Application Setup Script
 *
 * Automates creation of the GuShen Web application in Zitadel console.
 * Run once to configure authentication, then discard.
 *
 * Usage: bun run scripts/setup-zitadel-app.ts
 */

import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "fs";
import { resolve } from "path";

const ZITADEL_URL = "https://auth.lurus.cn";
const ADMIN_EMAIL = "admin@lurus.cn";
const ADMIN_PASSWORD = "Lurus@ops";
const APP_NAME = "gushen-web";

const REDIRECT_URIS = [
  "http://localhost:3000/api/auth/callback/zitadel",
  "https://gushen.lurus.cn/api/auth/callback/zitadel",
];
const POST_LOGOUT_URIS = [
  "http://localhost:3000/auth/login",
  "https://gushen.lurus.cn/auth/login",
];

async function run() {
  // On Windows, the downloaded headless-shell often times out.
  // Try system browsers in order: Edge → Chrome → downloaded Chromium.
  let browser;
  const candidates: Array<{ channel?: string; headless: boolean }> = [
    { channel: "msedge", headless: true },
    { channel: "chrome",  headless: true },
    { channel: "msedge", headless: false },
    { headless: false },                    // downloaded Chromium, visible
  ];
  for (const opts of candidates) {
    try {
      console.log(`  Trying browser: channel=${opts.channel ?? "chromium"} headless=${opts.headless}`);
      browser = await chromium.launch({ ...opts, timeout: 30_000 });
      console.log("  ✓ Browser launched");
      break;
    } catch {
      // try next
    }
  }
  if (!browser) throw new Error("Could not launch any browser. Install Chrome or Edge.");

  const context = await browser.newContext({
    ignoreHTTPSErrors: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    console.log("[1/6] Navigating to Zitadel console...");
    await page.goto(`${ZITADEL_URL}/ui/console`, { waitUntil: "networkidle", timeout: 30000 });

    // ---------- Login ----------
    console.log("[2/6] Logging in as admin...");

    // Fill login form
    await page.waitForSelector('input[type="text"], input[name="loginName"]', { timeout: 15000 });
    await page.fill('input[type="text"], input[name="loginName"]', ADMIN_EMAIL);
    await page.keyboard.press("Enter");

    // Wait for password field
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.keyboard.press("Enter");

    // Wait for console to load after login
    await page.waitForURL(/\/ui\/console.*/, { timeout: 20000 });
    console.log("  ✓ Logged in successfully");

    // ---------- Navigate to Projects ----------
    console.log("[3/6] Navigating to Projects...");
    await page.goto(`${ZITADEL_URL}/ui/console/projects`, { waitUntil: "networkidle", timeout: 20000 });

    // Click on lurus-api project (reuse it) or ZITADEL project
    // Try to find the lurus-api project link
    const projectLinks = await page.locator('a, button').filter({ hasText: /lurus-api/i }).all();

    let projectUrl: string;
    if (projectLinks.length > 0) {
      console.log("  Found lurus-api project, using it");
      await projectLinks[0]!.click();
      await page.waitForLoadState("networkidle");
      projectUrl = page.url();
    } else {
      // Take screenshot for debugging
      await page.screenshot({ path: "scripts/debug-projects.png" });
      console.log("  Warning: lurus-api project not found, using current URL");
      projectUrl = page.url();
    }

    console.log("  Project URL:", projectUrl);

    // ---------- Create New Application ----------
    console.log("[4/6] Creating GuShen Web application...");

    // Look for "New Application" or "+" button
    const addAppBtn = page.locator('button, a').filter({ hasText: /new app|add app|application|\+/i }).first();

    if (await addAppBtn.isVisible({ timeout: 5000 })) {
      await addAppBtn.click();
    } else {
      // Try clicking an app section
      const appSection = page.locator('[data-testid="applications"], .app-section, app-list-card').first();
      await appSection.locator('button').first().click();
    }

    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "scripts/debug-newapp.png" });

    // Fill application name
    const nameInput = page.locator('input[formcontrolname="name"], input[placeholder*="name" i], input[id*="name" i]').first();
    if (await nameInput.isVisible({ timeout: 5000 })) {
      await nameInput.fill(APP_NAME);
    } else {
      console.log("  Warning: name input not found");
    }

    // Select "Web" type (not Native or User Agent)
    const webOption = page.locator('mat-card, .type-card, [class*="card"]').filter({ hasText: /^web$/i }).first();
    if (await webOption.isVisible({ timeout: 3000 })) {
      await webOption.click();
    }

    // Click Next/Continue
    const nextBtn = page.locator('button').filter({ hasText: /next|continue|weiter/i }).first();
    if (await nextBtn.isVisible({ timeout: 3000 })) {
      await nextBtn.click();
      await page.waitForLoadState("networkidle");
    }

    // Choose PKCE auth method (if prompted)
    const pkceOption = page.locator('mat-radio-button, [class*="radio"]').filter({ hasText: /pkce/i }).first();
    if (await pkceOption.isVisible({ timeout: 3000 })) {
      await pkceOption.click();
      const nextBtn2 = page.locator('button').filter({ hasText: /next|continue/i }).first();
      if (await nextBtn2.isVisible()) await nextBtn2.click();
      await page.waitForLoadState("networkidle");
    }

    // Add redirect URIs
    for (const uri of REDIRECT_URIS) {
      const uriInput = page.locator('input[formcontrolname="uri"], input[placeholder*="redirect" i], input[placeholder*="uri" i]').last();
      if (await uriInput.isVisible({ timeout: 3000 })) {
        await uriInput.fill(uri);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);
      }
    }

    // Click Create/Submit
    const createBtn = page.locator('button[type="submit"], button').filter({ hasText: /create|erstellen|save/i }).first();
    if (await createBtn.isVisible({ timeout: 3000 })) {
      await createBtn.click();
      await page.waitForLoadState("networkidle");
    }

    // ---------- Extract Client ID ----------
    console.log("[5/6] Extracting Client ID...");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "scripts/debug-app-created.png" });

    // Look for client_id on the page
    const pageContent = await page.content();
    const clientIdMatch = pageContent.match(/(\d{15,20}@[\w-]+)/);

    let clientId = "";
    if (clientIdMatch) {
      clientId = clientIdMatch[1]!;
      console.log("  ✓ Client ID found:", clientId);
    } else {
      // Look for client_id in text nodes
      const codeElements = await page.locator('code, .client-id, [class*="clientId"], td').all();
      for (const el of codeElements) {
        const text = await el.innerText();
        if (text.match(/\d{15,20}@[\w-]+/)) {
          clientId = text.trim();
          break;
        }
      }
      if (clientId) {
        console.log("  ✓ Client ID found:", clientId);
      } else {
        console.log("  ⚠ Client ID not found in page content - check debug screenshots");
        // Save page content for debugging
        writeFileSync("scripts/debug-page.html", pageContent);
      }
    }

    // ---------- Update .env.local ----------
    console.log("[6/6] Updating .env.local...");
    if (clientId) {
      const envPath = resolve(process.cwd(), ".env.local");
      let envContent = readFileSync(envPath, "utf-8");
      envContent = envContent.replace(
        /^ZITADEL_CLIENT_ID=.*/m,
        `ZITADEL_CLIENT_ID=${clientId}`,
      );
      writeFileSync(envPath, envContent);
      console.log("  ✓ .env.local updated with ZITADEL_CLIENT_ID=" + clientId);
    }

    // Print summary
    console.log("\n=== Setup Complete ===");
    console.log("App Name:  ", APP_NAME);
    console.log("Client ID: ", clientId || "(check debug-app-created.png)");
    console.log("Auth Method: PKCE (no client secret needed)");
    console.log("\nRedirect URIs configured:");
    REDIRECT_URIS.forEach((u) => console.log("  -", u));
    console.log("\nNext step: restart gushen-web dev server");

  } catch (err) {
    console.error("\n[ERROR]", err);
    await page.screenshot({ path: "scripts/debug-error.png" });
    console.log("Debug screenshots saved to scripts/debug-*.png");
  } finally {
    await browser.close();
  }
}

run();
