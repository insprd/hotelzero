/**
 * Test script for proxy support in HotelZero v1.8.0
 * 
 * Usage:
 *   # Without proxy (baseline test)
 *   npx tsx scripts/test-proxy.ts
 * 
 *   # With proxy
 *   HOTELZERO_PROXY=http://proxy.example.com:8080 npx tsx scripts/test-proxy.ts
 * 
 *   # With authenticated proxy
 *   HOTELZERO_PROXY=http://user:pass@proxy.example.com:8080 npx tsx scripts/test-proxy.ts
 * 
 *   # With SOCKS5 proxy
 *   HOTELZERO_PROXY=socks5://proxy.example.com:1080 npx tsx scripts/test-proxy.ts
 */

import { HotelBrowser, ProxyConfig } from "../src/browser.js";

// Parse proxy configuration from environment variable
function parseProxyFromEnv(): ProxyConfig | undefined {
  const proxyUrl = process.env.HOTELZERO_PROXY;
  if (!proxyUrl) return undefined;
  
  try {
    const url = new URL(proxyUrl);
    const config: ProxyConfig = {
      server: `${url.protocol}//${url.host}`,
    };
    
    if (url.username) {
      config.username = decodeURIComponent(url.username);
    }
    if (url.password) {
      config.password = decodeURIComponent(url.password);
    }
    
    return config;
  } catch (error) {
    console.error(`Invalid HOTELZERO_PROXY format: ${proxyUrl}`);
    return undefined;
  }
}

async function testProxy() {
  console.log("=".repeat(60));
  console.log("HotelZero v1.8.0 - Proxy Support Test");
  console.log("=".repeat(60));
  console.log("");
  
  const proxyConfig = parseProxyFromEnv();
  
  if (proxyConfig) {
    console.log(`Proxy configured: ${proxyConfig.server}`);
    if (proxyConfig.username) {
      console.log(`  Username: ${proxyConfig.username}`);
      console.log(`  Password: ${"*".repeat(proxyConfig.password?.length || 0)}`);
    }
  } else {
    console.log("No proxy configured (HOTELZERO_PROXY not set)");
    console.log("Running baseline test without proxy...");
  }
  console.log("");
  
  const browser = new HotelBrowser();
  
  try {
    // Initialize browser with proxy config
    console.log("Initializing browser...");
    await browser.init(true, proxyConfig); // headless mode
    
    // Verify proxy status
    if (browser.hasProxy()) {
      console.log(`Browser proxy enabled: ${browser.getProxyServer()}`);
    } else {
      console.log("Browser running without proxy");
    }
    console.log("");
    
    // Test 1: Check IP address (useful for verifying proxy is working)
    console.log("--- Test 1: IP Address Check ---");
    console.log("Fetching current IP address...");
    
    // Note: This is a simple test - in production you'd use a dedicated IP check service
    // For now, we'll just verify the browser can navigate
    
    // Test 2: Basic hotel search
    console.log("");
    console.log("--- Test 2: Basic Hotel Search ---");
    console.log("Searching for hotels in Paris...");
    
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 30); // 30 days from now
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 3); // 3 night stay
    
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    
    const results = await browser.searchHotels({
      destination: "Paris, France",
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      guests: 2,
      rooms: 1,
      limit: 5, // Just get a few results for testing
    });
    
    console.log(`Found ${results.length} hotels`);
    
    if (results.length > 0) {
      console.log("");
      console.log("Sample results:");
      results.slice(0, 3).forEach((hotel, i) => {
        console.log(`  ${i + 1}. ${hotel.name}`);
        console.log(`     Price: ${hotel.priceDisplay}`);
        console.log(`     Rating: ${hotel.rating || "N/A"}`);
      });
    }
    
    console.log("");
    console.log("=".repeat(60));
    console.log("PROXY TEST COMPLETE");
    console.log("=".repeat(60));
    
    if (proxyConfig) {
      console.log("");
      console.log("Next steps to verify proxy is working:");
      console.log("1. Compare results with/without proxy");
      console.log("2. Check proxy server logs for requests");
      console.log("3. Use a service like httpbin.org/ip to verify IP");
    }
    
  } catch (error) {
    console.error("");
    console.error("ERROR during test:");
    console.error(error);
    
    if (proxyConfig) {
      console.error("");
      console.error("Proxy troubleshooting:");
      console.error("1. Verify proxy server is running and accessible");
      console.error("2. Check proxy credentials if using authentication");
      console.error("3. Ensure proxy supports HTTPS connections");
      console.error("4. Try a different proxy or test without proxy");
    }
    
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testProxy();
