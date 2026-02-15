// Test: Find hotels in Puerto Rico via MCP-style call with comprehensive filters
import { HotelBrowser, HotelSearchParams, HotelFilters } from "./browser.js";

async function testFindHotels() {
  const browser = new HotelBrowser();
  
  console.log("Initializing browser...");
  await browser.init(false); // visible browser for debugging
  
  // MCP-style parameters
  const searchParams: HotelSearchParams = {
    destination: "Puerto Rico",
    checkIn: "2026-03-07",
    checkOut: "2026-03-14",
    guests: 2,
    rooms: 1,
  };

  // Test with comprehensive filters
  const filters: HotelFilters = {
    beachfront: true,       // Beachfront property
    freeWifi: true,         // Free WiFi
    fitness: true,          // Gym/fitness center
    pool: true,             // Swimming pool
    minRating: 8.0,         // Very Good or better
    propertyType: "resort", // Resorts only
    freeCancellation: true, // Free cancellation
  };

  console.log("\n=== Finding RESORT hotels in Puerto Rico ===");
  console.log("Dates: March 7-14, 2026");
  console.log("Filters: beachfront, resort, wifi, gym, pool, rating >= 8.0, free cancellation\n");
  
  const results = await browser.searchHotels(searchParams, filters);
  
  console.log(`Found ${results.length} hotels:\n`);
  
  results.slice(0, 15).forEach((hotel, i) => {
    console.log(`${i + 1}. ${hotel.name}`);
    console.log(`   Price: ${hotel.priceDisplay}`);
    if (hotel.rating) {
      console.log(`   Rating: ${hotel.rating}/10 ${hotel.ratingText} (${hotel.reviewCount || "?"} reviews)`);
    }
    if (hotel.distanceToCenter) {
      console.log(`   Location: ${hotel.distanceToCenter}`);
    }
    if (hotel.amenities.length > 0) {
      console.log(`   Amenities: ${hotel.amenities.join(", ")}`);
    }
    if (hotel.highlights.length > 0) {
      console.log(`   Highlights: ${hotel.highlights.join(", ")}`);
    }
    if (hotel.matchScore !== undefined && hotel.matchScore > 0) {
      console.log(`   Match Score: ${hotel.matchScore}`);
      if (hotel.matchReasons && hotel.matchReasons.length > 0) {
        console.log(`   Why it matches: ${hotel.matchReasons.join(", ")}`);
      }
    }
    if (hotel.link) {
      const shortLink = hotel.link.split("?")[0];
      console.log(`   Book: ${shortLink}`);
    }
    console.log();
  });
  
  await browser.takeScreenshot("puerto-rico-results.png");
  console.log("Screenshot saved to puerto-rico-results.png");
  
  await browser.close();
}

testFindHotels().catch(console.error);
