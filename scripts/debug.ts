// Debug: Extract raw HTML from hotel cards to see what's available
import { chromium } from "playwright";

async function debug() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  
  const url = "https://www.booking.com/searchresults.html?ss=San+Juan%2C+Puerto+Rico&checkin=2026-03-01&checkout=2026-03-05&group_adults=2&no_rooms=1&selected_currency=USD&nflt=review_score%3D80";
  
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  
  // Dismiss popups
  try {
    const btn = await page.$('[aria-label="Dismiss sign in information."]');
    if (btn) await btn.click();
  } catch {}
  
  // Get first hotel card's full HTML
  const cardHtml = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="property-card"]');
    return card?.outerHTML || "No card found";
  });
  
  console.log("First hotel card HTML:\n");
  console.log(cardHtml);
  
  // Also extract text content to see what amenities are visible
  const cardText = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="property-card"]');
    return card?.textContent || "";
  });
  
  console.log("\n\nCard text content:\n");
  console.log(cardText);
  
  await page.screenshot({ path: "debug-screenshot.png" });
  await browser.close();
}

debug().catch(console.error);
