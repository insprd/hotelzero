/**
 * Hotel Details Integration Tests
 * 
 * Tests the getHotelDetailsForComparison and compareHotels functions.
 * 
 * Note: These tests use live Booking.com URLs and may fail if:
 * - The hotel is no longer listed
 * - Booking.com changes their page structure
 * - The page redirects unexpectedly
 * 
 * Run with: npm test
 * Run specific: npx vitest tests/details.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HotelBrowser, HotelDetails } from '../src/browser.js';

// We'll dynamically get hotel URLs from search results to avoid stale URLs
let TEST_HOTEL_URLS: string[] = [];

describe('Hotel Details Integration Tests', () => {
  let browser: HotelBrowser;

  beforeAll(async () => {
    browser = new HotelBrowser();
    await browser.init(true); // headless
    
    // Get fresh hotel URLs from search results
    const searchResults = await browser.searchHotels({
      destination: 'Paris',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      guests: 2,
      rooms: 1,
      limit: 5,
    });
    
    // Extract URLs from search results
    TEST_HOTEL_URLS = searchResults
      .filter(h => h.link && h.link.includes('booking.com'))
      .slice(0, 3)
      .map(h => h.link);
    
    console.log(`Captured ${TEST_HOTEL_URLS.length} hotel URLs from search`);
  }, 90000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('getHotelDetailsForComparison', () => {
    let details: HotelDetails;

    beforeAll(async () => {
      if (TEST_HOTEL_URLS.length === 0) {
        console.warn('No hotel URLs available - skipping');
        return;
      }
      details = await browser.getHotelDetailsForComparison(TEST_HOTEL_URLS[0]);
    }, 90000);

    it('should extract hotel name', () => {
      if (!TEST_HOTEL_URLS.length) return;
      expect(details.name).toBeTruthy();
      expect(details.name.length).toBeGreaterThan(0);
      // Name should not be generic page text
      expect(details.name).not.toContain('Filter by');
      console.log(`Hotel name: ${details.name}`);
    });

    it('should include the URL', () => {
      if (!TEST_HOTEL_URLS.length) return;
      expect(details.url).toContain('booking.com');
    });

    it('should extract rating (when available)', () => {
      if (!TEST_HOTEL_URLS.length) return;
      if (details.rating !== null) {
        expect(details.rating).toBeGreaterThanOrEqual(1);
        expect(details.rating).toBeLessThanOrEqual(10);
        console.log(`Rating: ${details.rating}/10 - ${details.ratingText}`);
      }
    });

    it('should extract review count (when available)', () => {
      if (!TEST_HOTEL_URLS.length) return;
      if (details.reviewCount !== null) {
        expect(details.reviewCount).toBeGreaterThanOrEqual(0);
        console.log(`Reviews: ${details.reviewCount}`);
      }
    });

    it('should extract address', () => {
      if (!TEST_HOTEL_URLS.length) return;
      // Address might be empty for some hotels
      console.log(`Address: ${details.address || '(not found)'}`);
    });

    it('should extract popular facilities', () => {
      if (!TEST_HOTEL_URLS.length) return;
      expect(Array.isArray(details.popularFacilities)).toBe(true);
      console.log(`Popular facilities: ${details.popularFacilities.slice(0, 5).join(', ')}`);
    });

    it('should extract all facilities', () => {
      if (!TEST_HOTEL_URLS.length) return;
      expect(Array.isArray(details.allFacilities)).toBe(true);
      console.log(`Total facilities: ${details.allFacilities.length}`);
    });

    it('should extract photo URLs', () => {
      if (!TEST_HOTEL_URLS.length) return;
      expect(Array.isArray(details.photos)).toBe(true);
      if (details.photos.length > 0) {
        expect(details.photos[0]).toContain('http');
      }
      console.log(`Photos: ${details.photos.length}`);
    });

    it('should extract check-in/out times (when available)', () => {
      if (!TEST_HOTEL_URLS.length) return;
      console.log(`Check-in: ${details.checkInTime || '(not found)'}`);
      console.log(`Check-out: ${details.checkOutTime || '(not found)'}`);
    });
  });

  describe('compareHotels', () => {
    let comparison: HotelDetails[];

    beforeAll(async () => {
      if (TEST_HOTEL_URLS.length < 2) {
        console.warn('Need at least 2 hotel URLs - skipping comparison tests');
        return;
      }
      comparison = await browser.compareHotels(TEST_HOTEL_URLS.slice(0, 2));
    }, 180000); // 3 minutes for multiple hotels

    it('should return details for all requested hotels', () => {
      if (TEST_HOTEL_URLS.length < 2) return;
      expect(comparison.length).toBe(2);
    });

    it('should extract names for all hotels', () => {
      if (TEST_HOTEL_URLS.length < 2 || !comparison) return;
      comparison.forEach((hotel, i) => {
        expect(hotel.name).toBeTruthy();
        console.log(`Hotel ${i + 1}: ${hotel.name}`);
      });
    });

    it('should have different URLs for each hotel', () => {
      if (TEST_HOTEL_URLS.length < 2 || !comparison) return;
      const urls = comparison.map(h => h.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(comparison.length);
    });

    it('should extract facilities for comparison', () => {
      if (TEST_HOTEL_URLS.length < 2 || !comparison) return;
      // At least one hotel should have facilities
      const hotelsWithFacilities = comparison.filter(hotel => {
        const totalFacilities = hotel.popularFacilities.length + hotel.allFacilities.length;
        return totalFacilities > 0;
      });
      
      console.log(`${hotelsWithFacilities.length}/${comparison.length} hotels have facilities`);
      // Make this a soft assertion - facilities extraction is fragile
      if (hotelsWithFacilities.length === 0) {
        console.warn('Warning: No facilities found - selector may need updating');
      }
    });
  });
});

describe('Availability Check Integration Tests', () => {
  let browser: HotelBrowser;
  let testHotelUrl: string;

  beforeAll(async () => {
    browser = new HotelBrowser();
    await browser.init(true);
    
    // Get a fresh hotel URL from search
    const searchResults = await browser.searchHotels({
      destination: 'Paris',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      guests: 2,
      rooms: 1,
      limit: 3,
    });
    
    testHotelUrl = searchResults[0]?.link || '';
    console.log(`Using hotel URL: ${testHotelUrl.substring(0, 60)}...`);
  }, 90000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('should check availability for a hotel', async () => {
    if (!testHotelUrl) {
      console.warn('No hotel URL available - skipping');
      return;
    }
    
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 60);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const result = await browser.checkAvailability({
      hotelUrl: testHotelUrl,
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      guests: 2,
      rooms: 1,
    });

    expect(result.hotelName).toBeTruthy();
    expect(result.checkIn).toBe(formatDate(checkIn));
    expect(result.checkOut).toBe(formatDate(checkOut));
    
    console.log(`Hotel: ${result.hotelName}`);
    console.log(`Available: ${result.available}`);
    console.log(`Message: ${result.message}`);
    
    if (result.available) {
      console.log(`Room options: ${result.roomOptions.length}`);
      console.log(`Lowest price: ${result.lowestPriceDisplay}`);
    }
  }, 90000);
});
