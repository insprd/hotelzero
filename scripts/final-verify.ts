/**
 * Final verification test for HotelZero v1.3.1
 */
import { HotelBrowser } from "../src/browser.js";

async function finalTest() {
  const browser = new HotelBrowser();
  
  try {
    console.log("HotelZero v1.3.1 Final Verification");
    console.log("===================================\n");
    
    await browser.init(true);
    
    const tests = [
      { name: "Basic search", pass: false },
      { name: "Currency (EUR)", pass: false },
      { name: "Sort (price_lowest)", pass: false },
      { name: "Limit (10)", pass: false },
      { name: "Limit (50)", pass: false },
      { name: "Filters (pool + minRating)", pass: false },
    ];
    
    // Test 1: Basic
    console.log("1. Basic search...");
    const r1 = await browser.searchHotels({
      destination: "Paris, France",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      rooms: 1,
    });
    tests[0].pass = r1.length > 0;
    console.log(`   Found ${r1.length} hotels: ${tests[0].pass ? 'PASS' : 'FAIL'}`);
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Test 2: Currency
    console.log("2. Currency (EUR)...");
    const r2 = await browser.searchHotels({
      destination: "Paris, France",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      rooms: 1,
      currency: "EUR",
    });
    const hasEuro = r2[0]?.priceDisplay?.includes("€") || false;
    tests[1].pass = r2.length > 0 && hasEuro;
    console.log(`   Price: ${r2[0]?.priceDisplay}, Has €: ${hasEuro}: ${tests[1].pass ? 'PASS' : 'FAIL'}`);
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Test 3: Sort
    console.log("3. Sort (price_lowest)...");
    const r3 = await browser.searchHotels({
      destination: "Paris, France",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      rooms: 1,
      sortBy: "price_lowest",
    });
    // Check if first few prices are low
    const prices = r3.slice(0, 3).map(h => h.price).filter(p => p !== null) as number[];
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    tests[2].pass = r3.length > 0 && avgPrice < 300; // Paris budget hotels
    console.log(`   First 3 avg price: $${avgPrice.toFixed(0)}: ${tests[2].pass ? 'PASS' : 'FAIL'}`);
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Test 4: Limit 10
    console.log("4. Limit (10)...");
    const r4 = await browser.searchHotels({
      destination: "Paris, France",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      rooms: 1,
      limit: 10,
    });
    tests[3].pass = r4.length === 10;
    console.log(`   Got ${r4.length} results: ${tests[3].pass ? 'PASS' : 'FAIL'}`);
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Test 5: Limit 50
    console.log("5. Limit (50)...");
    const r5 = await browser.searchHotels({
      destination: "Paris, France",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      rooms: 1,
      limit: 50,
    });
    tests[4].pass = r5.length >= 45; // Allow some variance
    console.log(`   Got ${r5.length} results: ${tests[4].pass ? 'PASS' : 'FAIL'}`);
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Test 6: Filters
    console.log("6. Filters (pool + minRating 8)...");
    const r6 = await browser.searchHotels(
      {
        destination: "Paris, France",
        checkIn: "2026-05-01",
        checkOut: "2026-05-03",
        guests: 2,
        rooms: 1,
      },
      {
        pool: true,
        minRating: 8,
      }
    );
    const allHighRated = r6.every(h => !h.rating || h.rating >= 8);
    tests[5].pass = r6.length > 0 && allHighRated;
    console.log(`   Found ${r6.length}, all rating>=8: ${allHighRated}: ${tests[5].pass ? 'PASS' : 'FAIL'}`);
    
    // Summary
    console.log("\n===================================");
    console.log("SUMMARY");
    console.log("===================================");
    tests.forEach(t => console.log(`${t.pass ? '✓' : '✗'} ${t.name}`));
    
    const passed = tests.filter(t => t.pass).length;
    console.log(`\n${passed}/${tests.length} tests passed`);
    
    if (passed === tests.length) {
      console.log("\nAll tests passed! Ready to publish v1.3.1");
    }
    
  } finally {
    await browser.close();
  }
}

finalTest().catch(console.error);
