/**
 * Test script for get_price_calendar functionality
 */
import { HotelBrowser } from "../src/browser.js";

async function testPriceCalendar() {
  const browser = new HotelBrowser();
  
  try {
    console.log("Initializing browser...");
    await browser.init(false); // non-headless to see what's happening
    
    // Test hotel URL
    const hotelUrl = "https://www.booking.com/hotel/fr/des-deux-iles.html";
    
    // Get start date (1 week from now)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const startDateStr = startDate.toISOString().split("T")[0];
    
    console.log(`\n=== Testing price calendar for ${hotelUrl} ===`);
    console.log(`Start date: ${startDateStr}`);
    console.log(`Checking 7 nights...\n`);
    
    const result = await browser.getPriceCalendar(
      hotelUrl,
      startDateStr,
      7,  // 7 nights
      2,  // 2 guests
      1,  // 1 room
      "USD"
    );
    
    console.log(`Hotel: ${result.hotelName}`);
    console.log(`Date range: ${result.startDate} to ${result.endDate}`);
    console.log(`Currency: ${result.currency}`);
    console.log("");
    
    console.log("=== PRICE SUMMARY ===");
    console.log(`Lowest price:  $${result.lowestPrice} on ${result.lowestPriceDate}`);
    console.log(`Highest price: $${result.highestPrice} on ${result.highestPriceDate}`);
    console.log(`Average price: $${result.averagePrice}`);
    console.log("");
    
    console.log("=== PRICES BY DATE ===");
    result.prices.forEach(p => {
      const marker = p.price === result.lowestPrice ? " ★ BEST" : 
                     p.price === result.highestPrice ? " (highest)" : "";
      const status = p.available ? p.priceDisplay : "N/A";
      console.log(`${p.date}: ${status}${marker}`);
    });
    
    console.log("\n=== Test completed successfully! ===");
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
}

testPriceCalendar();
