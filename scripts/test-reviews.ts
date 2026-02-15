/**
 * Test script for get_reviews functionality
 */
import { HotelBrowser } from "../src/browser.js";

async function testReviews() {
  const browser = new HotelBrowser();
  
  try {
    console.log("Initializing browser...");
    await browser.init(false); // non-headless to see what's happening
    
    // Test hotel URL
    const hotelUrl = "https://www.booking.com/hotel/fr/des-deux-iles.html";
    
    console.log("\n=== Test 1: Basic review fetch (default options) ===");
    const result1 = await browser.getReviews(hotelUrl);
    console.log(`Hotel: ${result1.hotelName}`);
    console.log(`Overall Rating: ${result1.overallRating}/10 (${result1.totalReviews} reviews)`);
    console.log("Rating Breakdown:", JSON.stringify(result1.ratingBreakdown, null, 2));
    console.log(`Reviews fetched: ${result1.reviews.length}`);
    if (result1.reviews.length > 0) {
      console.log("First review:", JSON.stringify(result1.reviews[0], null, 2));
    }
    
    console.log("\n=== Test 2: Fetch 20 reviews sorted by highest scores ===");
    const result2 = await browser.getReviews(hotelUrl, 20, "highest");
    console.log(`Reviews fetched: ${result2.reviews.length}`);
    if (result2.reviews.length > 0) {
      console.log("First review score:", result2.reviews[0].rating);
      console.log("Last review score:", result2.reviews[result2.reviews.length - 1].rating);
    }
    
    console.log("\n=== Test 3: Filter by couples ===");
    const result3 = await browser.getReviews(hotelUrl, 5, "recent", "couples");
    console.log(`Reviews fetched: ${result3.reviews.length}`);
    result3.reviews.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title} - ${r.travelerType} - ${r.rating}/10`);
    });
    
    console.log("\n=== All tests completed successfully! ===");
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
}

testReviews();
