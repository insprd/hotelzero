// Comprehensive debug: Extract ALL filter codes from Booking.com
import { chromium } from "playwright";

async function extractAllFilters() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });
  const page = await context.newPage();

  // Go to a popular destination to get full filter list
  await page.goto("https://www.booking.com/searchresults.html?ss=New+York&checkin=2026-03-07&checkout=2026-03-14&group_adults=2&no_rooms=1");
  await page.waitForTimeout(5000);

  // Dismiss popups
  try {
    await page.click('#onetrust-accept-btn-handler', { timeout: 3000 });
  } catch {}
  try {
    await page.click('button[aria-label="Dismiss sign-in info."]', { timeout: 2000 });
  } catch {}

  // Extract ALL filter inputs
  const allFilters = await page.evaluate(() => {
    const filters: Record<string, Array<{name: string, value: string, label: string, count: string}>> = {};
    
    // Get all filter checkboxes
    const checkboxes = document.querySelectorAll('input[type="checkbox"][name]');
    
    checkboxes.forEach(input => {
      const inp = input as HTMLInputElement;
      const name = inp.name;
      const value = inp.value;
      
      // Get label text
      let label = '';
      let count = '';
      const container = inp.closest('[data-filters-item]') || inp.parentElement?.parentElement;
      if (container) {
        const labelEl = container.querySelector('span');
        label = labelEl?.textContent?.trim() || '';
        // Extract count if present (usually in parentheses or separate span)
        const countMatch = label.match(/(\d+)$/);
        if (countMatch) {
          count = countMatch[1];
          label = label.replace(/\s*\d+$/, '').trim();
        }
      }
      
      if (!filters[name]) {
        filters[name] = [];
      }
      
      // Avoid duplicates
      if (!filters[name].some(f => f.value === value)) {
        filters[name].push({ name, value, label, count });
      }
    });
    
    return filters;
  });

  // Print organized output
  console.log("// ============================================");
  console.log("// BOOKING.COM FILTER CODES - Complete Reference");
  console.log("// ============================================\n");

  const categories = {
    'review_score': 'Rating Filters',
    'class': 'Star Rating',
    'hotelfacility': 'Hotel Facilities',
    'roomfacility': 'Room Facilities',
    'popular_activities': 'Activities & Amenities',
    'ht_beach': 'Beach Access',
    'ht_id': 'Property Types',
    'mealplan': 'Meal Plans',
    'stay_type': 'Stay Type',
    'fc': 'Cancellation & Payment',
    'accessible_facilities': 'Accessibility - Hotel',
    'accessible_room_facilities': 'Accessibility - Room',
    'chaincode': 'Hotel Chains',
    'privacy_type': 'Privacy',
    'SustainablePropertyLevelFilter': 'Sustainability',
  };

  for (const [key, title] of Object.entries(categories)) {
    if (allFilters[key] && allFilters[key].length > 0) {
      console.log(`// --- ${title} (${key}) ---`);
      allFilters[key].forEach(f => {
        console.log(`// ${f.name}=${f.value} => "${f.label}"`);
      });
      console.log();
    }
  }

  // Print any other categories we didn't anticipate
  console.log("// --- Other Filters ---");
  for (const [key, items] of Object.entries(allFilters)) {
    if (!categories[key as keyof typeof categories] && items.length > 0) {
      console.log(`// Category: ${key}`);
      items.forEach(f => {
        console.log(`//   ${f.name}=${f.value} => "${f.label}"`);
      });
    }
  }

  await browser.close();
}

extractAllFilters().catch(console.error);
