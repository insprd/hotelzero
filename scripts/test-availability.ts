/**
 * Test the check_availability feature
 */
import { HotelBrowser } from "../src/browser.js";

async function testAvailability() {
  const browser = new HotelBrowser();
  
  try {
    console.log("Testing check_availability feature");
    console.log("==================================\n");
    
    await browser.init(true); // headless
    
    // First, search for hotels to get a URL - look for a hotel not apartment
    console.log("1. Searching for HOTELS in Paris...");
    const searchResults = await browser.searchHotels({
      destination: "Paris, France",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      rooms: 1,
      limit: 10,
    }, {
      propertyType: "hotel",
    });
    
    console.log(`   Found ${searchResults.length} hotels`);
    
    if (searchResults.length === 0) {
      throw new Error("No hotels found");
    }
    
    // Pick a hotel with good number of reviews (more likely to have availability)
    const hotel = searchResults.find(h => h.reviewCount && h.reviewCount > 500) || searchResults[0];
    const hotelUrl = hotel.link;
    console.log(`\n2. Checking availability for: ${hotel.name}`);
    console.log(`   Reviews: ${hotel.reviewCount}`);
    console.log(`   URL: ${hotelUrl.split("?")[0]}`);
    
    // Wait before making more requests
    await new Promise(r => setTimeout(r, 3000));
    
    // Check availability - use same dates as search to ensure availability
    console.log("\n3. Fetching availability for 2026-05-01 to 2026-05-03...");
    const availability = await browser.checkAvailability({
      hotelUrl,
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      rooms: 1,
    });
    
    console.log("\n4. Availability Results:");
    console.log("-".repeat(50));
    console.log(`Hotel: ${availability.hotelName}`);
    console.log(`Dates: ${availability.checkIn} to ${availability.checkOut}`);
    console.log(`Available: ${availability.available ? "YES" : "NO"}`);
    console.log(`Message: ${availability.message}`);
    
    if (availability.roomOptions.length > 0) {
      console.log(`\nRoom Options (${availability.roomOptions.length}):`);
      availability.roomOptions.forEach((room, i) => {
        console.log(`  ${i + 1}. ${room.name}`);
        console.log(`     Price: ${room.priceDisplay || "N/A"}`);
        if (room.sleeps) console.log(`     Sleeps: ${room.sleeps}`);
        if (room.bedType) console.log(`     Bed: ${room.bedType}`);
        if (room.cancellation) console.log(`     Cancellation: ${room.cancellation}`);
      });
    }
    
    if (availability.lowestPrice) {
      console.log(`\nLowest Price: ${availability.lowestPriceDisplay}`);
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("TEST PASSED: check_availability feature works!");
    
  } catch (error) {
    console.error("\nTEST FAILED:", error);
  } finally {
    await browser.close();
  }
}

testAvailability();
