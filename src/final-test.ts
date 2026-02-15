// Test the original query: Puerto Rico March 7-14, beach + wifi + gym
import { HotelBrowser, HotelSearchParams, HotelFilters } from "./browser.js";

async function testOriginalQuery() {
  const browser = new HotelBrowser();
  
  console.log("Initializing browser...");
  await browser.init(false);
  
  const searchParams: HotelSearchParams = {
    destination: "Puerto Rico",
    checkIn: "2026-03-07",
    checkOut: "2026-03-14",
    guests: 2,
    rooms: 1,
  };

  const filters: HotelFilters = {
    beachfront: true,
    freeWifi: true,
    fitness: true,
    minRating: 8.0,
  };

  console.log("\n=== Original Query: Puerto Rico Hotels ===");
  console.log("Dates: March 7-14, 2026");
  console.log("Filters: beachfront, wifi, gym, rating >= 8.0\n");
  
  const results = await browser.searchHotels(searchParams, filters);
  
  console.log(`Found ${results.length} hotels:\n`);
  
  results.slice(0, 10).forEach((hotel, i) => {
    console.log(`${i + 1}. ${hotel.name}`);
    console.log(`   Price: ${hotel.priceDisplay}`);
    if (hotel.rating) {
      console.log(`   Rating: ${hotel.rating}/10 ${hotel.ratingText} (${hotel.reviewCount || "?"} reviews)`);
    }
    if (hotel.amenities.length > 0) {
      console.log(`   Amenities: ${hotel.amenities.join(", ")}`);
    }
    if (hotel.matchScore !== undefined && hotel.matchScore > 0) {
      console.log(`   Match Score: ${hotel.matchScore}`);
      console.log(`   Why: ${hotel.matchReasons?.join(", ")}`);
    }
    const shortLink = hotel.link.split("?")[0];
    console.log(`   Book: ${shortLink}`);
    console.log();
  });
  
  await browser.takeScreenshot("final-test.png");
  console.log("Screenshot saved to final-test.png");
  
  await browser.close();
}

testOriginalQuery().catch(console.error);
