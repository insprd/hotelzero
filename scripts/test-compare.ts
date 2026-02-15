/**
 * Test the compare_hotels feature
 */
import { HotelBrowser } from "../src/browser.js";

async function testCompare() {
  const browser = new HotelBrowser();
  
  try {
    console.log("Testing compare_hotels feature");
    console.log("==============================\n");
    
    await browser.init(true); // headless
    
    // First, search for hotels to get some URLs
    console.log("1. Searching for hotels in Paris...");
    const searchResults = await browser.searchHotels({
      destination: "Paris, France",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      rooms: 1,
      limit: 5,
    });
    
    console.log(`   Found ${searchResults.length} hotels`);
    
    if (searchResults.length < 2) {
      throw new Error("Not enough hotels found for comparison");
    }
    
    // Get URLs for comparison
    const urls = searchResults.slice(0, 2).map(h => h.link);
    console.log("\n2. Comparing these hotels:");
    searchResults.slice(0, 2).forEach((h, i) => {
      console.log(`   ${i + 1}. ${h.name} - ${h.priceDisplay}`);
    });
    
    // Wait before making more requests
    await new Promise(r => setTimeout(r, 3000));
    
    // Compare
    console.log("\n3. Fetching detailed comparison...");
    const comparison = await browser.compareHotels(urls);
    
    console.log("\n4. Comparison Results:");
    console.log("-".repeat(50));
    
    comparison.forEach((hotel, i) => {
      console.log(`\nHotel ${i + 1}: ${hotel.name}`);
      console.log(`  Rating: ${hotel.rating}/10 ${hotel.ratingText}`);
      console.log(`  Reviews: ${hotel.reviewCount}`);
      console.log(`  Price: ${hotel.priceDisplay}`);
      console.log(`  Address: ${hotel.address || "N/A"}`);
      console.log(`  Highlights: ${hotel.highlights || "N/A"}`);
      console.log(`  Check-in: ${hotel.checkInTime || "N/A"}`);
      console.log(`  Check-out: ${hotel.checkOutTime || "N/A"}`);
      console.log(`  Top Facilities: ${hotel.popularFacilities.slice(0, 5).join(", ") || "N/A"}`);
    });
    
    console.log("\n" + "=".repeat(50));
    console.log("TEST PASSED: compare_hotels feature works!");
    
  } catch (error) {
    console.error("\nTEST FAILED:", error);
  } finally {
    await browser.close();
  }
}

testCompare();
