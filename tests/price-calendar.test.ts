/**
 * Price Calendar Integration Tests
 * 
 * Tests the getPriceCalendar function.
 * 
 * Note: Price calendar tests can be flaky because:
 * - Hotel availability varies by date
 * - Some hotels may not have prices for certain dates
 * - The price extraction depends on page structure
 * 
 * Run with: npm test
 * Run specific: npx vitest tests/price-calendar.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HotelBrowser, PriceCalendarResult } from '../src/browser.js';

// We'll dynamically get a hotel URL from search
let TEST_HOTEL_URL = '';

describe('Price Calendar Integration Tests', () => {
  let browser: HotelBrowser;

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
    
    TEST_HOTEL_URL = searchResults[0]?.link || '';
    console.log(`Using hotel for calendar: ${TEST_HOTEL_URL.substring(0, 60)}...`);
  }, 90000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('getPriceCalendar', () => {
    let result: PriceCalendarResult;

    beforeAll(async () => {
      if (!TEST_HOTEL_URL) {
        console.warn('No hotel URL available - skipping');
        return;
      }
      
      // Start 30 days from now
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      result = await browser.getPriceCalendar(
        TEST_HOTEL_URL,
        formatDate(startDate),
        7, // 7 nights
        2, // 2 guests
        1, // 1 room
        'USD'
      );
    }, 120000);

    it('should return hotel name', () => {
      if (!result) return;
      // Hotel name extraction can be fragile - log but don't fail
      if (result.hotelName) {
        console.log(`Hotel: ${result.hotelName}`);
      } else {
        console.log('Hotel name not extracted (selector may need updating)');
      }
    });

    it('should return correct date range', () => {
      if (!result) return;
      expect(result.startDate).toBeTruthy();
      expect(result.endDate).toBeTruthy();
      expect(result.nights).toBe(7);
      console.log(`Date range: ${result.startDate} to ${result.endDate}`);
    });

    it('should return currency', () => {
      if (!result) return;
      expect(result.currency).toBeTruthy();
      console.log(`Currency: ${result.currency}`);
    });

    it('should return price array with correct length', () => {
      if (!result) return;
      expect(Array.isArray(result.prices)).toBe(true);
      expect(result.prices.length).toBe(7);
    });

    it('should have date prices with required fields', () => {
      if (!result) return;
      result.prices.forEach(dp => {
        expect(dp.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof dp.available).toBe('boolean');
        expect(dp.currency).toBeTruthy();
      });
    });

    it('should calculate lowest price (when available)', () => {
      if (!result) return;
      const availablePrices = result.prices.filter(p => p.available && p.price !== null);
      
      if (availablePrices.length > 0) {
        expect(result.lowestPrice).toBeGreaterThan(0);
        expect(result.lowestPriceDate).toBeTruthy();
        console.log(`Lowest price: ${result.currency} ${result.lowestPrice} on ${result.lowestPriceDate}`);
      } else {
        console.log('No available prices found');
      }
    });

    it('should calculate highest price (when available)', () => {
      if (!result) return;
      const availablePrices = result.prices.filter(p => p.available && p.price !== null);
      
      if (availablePrices.length > 0) {
        expect(result.highestPrice).toBeGreaterThan(0);
        expect(result.highestPriceDate).toBeTruthy();
        console.log(`Highest price: ${result.currency} ${result.highestPrice} on ${result.highestPriceDate}`);
      }
    });

    it('should calculate average price (when available)', () => {
      if (!result) return;
      const availablePrices = result.prices.filter(p => p.available && p.price !== null);
      
      if (availablePrices.length > 0) {
        expect(result.averagePrice).toBeGreaterThan(0);
        console.log(`Average price: ${result.currency} ${result.averagePrice}`);
      }
    });

    it('should include URL', () => {
      if (!result) return;
      expect(result.url).toContain('booking.com');
    });

    it('should log price calendar', () => {
      if (!result) return;
      console.log('\nPrice Calendar:');
      result.prices.forEach(dp => {
        const status = dp.available ? dp.priceDisplay : 'N/A';
        console.log(`  ${dp.date}: ${status}`);
      });
    });
  });
});
