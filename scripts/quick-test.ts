/**
 * Quick test for HotelZero v1.3.1 (offset removed)
 * Tests: limit parameter still works
 */
import { HotelBrowser } from "../src/browser.js";

async function quickTest() {
  const browser = new HotelBrowser();
  
  try {
    console.log("Initializing browser...");
    await browser.init(true);
    
    console.log("\n=== TEST: Limit parameter ===");
    
    // Test limit = 10
    console.log("\nRequesting limit=10...");
    const results10 = await browser.searchHotels({
      destination: "Miami Beach, Florida",
      checkIn: "2026-04-01",
      checkOut: "2026-04-05",
      guests: 2,
      rooms: 1,
      limit: 10,
    });
    console.log(`Got ${results10.length} results (expected: 10)`);
    console.log(`PASS: ${results10.length === 10 ? 'YES' : 'NO'}`);
    
    // Wait
    await new Promise(r => setTimeout(r, 3000));
    
    // Test limit = 50
    console.log("\nRequesting limit=50...");
    const results50 = await browser.searchHotels({
      destination: "Miami Beach, Florida",
      checkIn: "2026-04-01",
      checkOut: "2026-04-05",
      guests: 2,
      rooms: 1,
      limit: 50,
    });
    console.log(`Got ${results50.length} results (expected: ~50)`);
    console.log(`PASS: ${results50.length >= 40 ? 'YES' : 'NO - may need more scrolling'}`);
    
    // Show sample results
    console.log("\nFirst 5 results:");
    results50.slice(0, 5).forEach((h, i) => {
      console.log(`  ${i + 1}. ${h.name} - ${h.priceDisplay}`);
    });
    
    console.log("\n=== TESTS COMPLETE ===");
    
  } finally {
    await browser.close();
  }
}

quickTest().catch(console.error);
