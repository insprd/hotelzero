// Test: Find hotels near beach with good wifi in San Juan
import { HotelBrowser } from "./browser.js";

async function test() {
  const browser = new HotelBrowser();
  
  console.log("Initializing browser...");
  await browser.init(false); // visible browser
  
  console.log("\n=== Finding beach hotels with WiFi in San Juan ===\n");
  
  const results = await browser.searchHotels(
    {
      destination: "San Juan, Puerto Rico",
      checkIn: "2026-03-01",
      checkOut: "2026-03-05",
      guests: 2,
      rooms: 1,
    },
    {
      beachfront: true,
      freeWifi: true,
      minRating: 8.0,
    }
  );
  
  console.log(`Found ${results.length} hotels:\n`);
  
  results.slice(0, 10).forEach((hotel, i) => {
    console.log(`${i + 1}. ${hotel.name}`);
    console.log(`   Price: ${hotel.priceDisplay}`);
    console.log(`   Rating: ${hotel.rating}/10 (${hotel.reviewCount} reviews)`);
    console.log(`   Location: ${hotel.distanceToCenter}`);
    console.log(`   Amenities: ${hotel.amenities.join(", ") || "None detected"}`);
    if (hotel.matchScore) {
      console.log(`   Match Score: ${hotel.matchScore}`);
      console.log(`   Why: ${hotel.matchReasons?.join(", ")}`);
    }
    console.log(`   Link: ${hotel.link}`);
    console.log();
  });
  
  await browser.takeScreenshot("beach-wifi-results.png");
  console.log("Screenshot saved to beach-wifi-results.png");
  
  await browser.close();
}

test().catch(console.error);
