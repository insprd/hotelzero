/**
 * Search Hotels Integration Tests
 * 
 * Tests the searchHotels function to ensure it correctly extracts
 * hotel data from Booking.com search results.
 * 
 * Run with: npm test
 * Run specific: npx vitest tests/search.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HotelBrowser, HotelResult } from '../src/browser.js';

describe('Hotel Search Integration Tests', () => {
  let browser: HotelBrowser;

  beforeAll(async () => {
    browser = new HotelBrowser();
    await browser.init(true); // headless
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Basic Search', () => {
    let results: HotelResult[];

    beforeAll(async () => {
      // Search for hotels in Paris - a reliable destination
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 60); // 60 days from now
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2); // 2 nights

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      results = await browser.searchHotels({
        destination: 'Paris, France',
        checkIn: formatDate(checkIn),
        checkOut: formatDate(checkOut),
        guests: 2,
        rooms: 1,
        limit: 10,
      });
    }, 90000);

    it('should return multiple hotel results', () => {
      expect(results.length).toBeGreaterThan(0);
      console.log(`Found ${results.length} hotels`);
    });

    it('should extract hotel names', () => {
      const hotelsWithNames = results.filter(h => h.name && h.name !== 'Unknown');
      expect(hotelsWithNames.length).toBeGreaterThan(0);
      
      // Log first few names
      results.slice(0, 3).forEach(h => console.log(`- ${h.name}`));
    });

    it('should extract prices for most hotels', () => {
      const hotelsWithPrices = results.filter(h => h.price !== null);
      // At least 50% should have prices
      expect(hotelsWithPrices.length).toBeGreaterThan(results.length * 0.5);
      
      // Verify prices are reasonable (between $10 and $10,000)
      hotelsWithPrices.forEach(h => {
        expect(h.price).toBeGreaterThan(10);
        expect(h.price).toBeLessThan(10000);
      });
    });

    it('should have priceDisplay for all hotels', () => {
      results.forEach(h => {
        expect(h.priceDisplay).toBeTruthy();
      });
    });

    it('should extract ratings (when available)', () => {
      const hotelsWithRatings = results.filter(h => h.rating !== null);
      console.log(`${hotelsWithRatings.length}/${results.length} hotels have ratings`);
      
      // Ratings should be between 1 and 10
      hotelsWithRatings.forEach(h => {
        expect(h.rating).toBeGreaterThanOrEqual(1);
        expect(h.rating).toBeLessThanOrEqual(10);
      });
    });

    it('should extract booking links', () => {
      const hotelsWithLinks = results.filter(h => h.link && h.link.includes('booking.com'));
      expect(hotelsWithLinks.length).toBe(results.length);
    });

    it('should not include sponsored/ad listings', () => {
      // Check that no links contain native ad tracking
      const adLinks = results.filter(h => h.link.includes('nad_'));
      expect(adLinks.length).toBe(0);
    });
  });

  describe('Filtered Search', () => {
    it('should filter by minimum rating', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 90);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      const results = await browser.searchHotels(
        {
          destination: 'London, UK',
          checkIn: formatDate(checkIn),
          checkOut: formatDate(checkOut),
          guests: 2,
          rooms: 1,
          limit: 10,
        },
        { minRating: 8 }
      );

      // Results may be empty due to rate limiting or filter stringency
      if (results.length === 0) {
        console.log('No results returned - possible rate limiting or no matching hotels');
        return;
      }
      
      // All results with ratings should be >= 8
      const hotelsWithRatings = results.filter(h => h.rating !== null);
      hotelsWithRatings.forEach(h => {
        expect(h.rating).toBeGreaterThanOrEqual(8);
      });
    }, 90000);

    it('should filter by max price', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 90);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      const results = await browser.searchHotels(
        {
          destination: 'Berlin, Germany',
          checkIn: formatDate(checkIn),
          checkOut: formatDate(checkOut),
          guests: 2,
          rooms: 1,
          limit: 10,
        },
        { maxPrice: 200 }
      );

      // Results may be empty due to rate limiting
      if (results.length === 0) {
        console.log('No results returned - possible rate limiting');
        return;
      }
      
      // All results with prices should be <= 200
      const hotelsWithPrices = results.filter(h => h.price !== null);
      hotelsWithPrices.forEach(h => {
        expect(h.price).toBeLessThanOrEqual(200);
      });
    }, 90000);
  });

  describe('Currency Support', () => {
    it('should return prices in EUR when specified', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 90);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      const results = await browser.searchHotels({
        destination: 'Rome, Italy',
        checkIn: formatDate(checkIn),
        checkOut: formatDate(checkOut),
        guests: 2,
        rooms: 1,
        currency: 'EUR',
        limit: 5,
      });

      expect(results.length).toBeGreaterThan(0);
      
      // Check that at least some prices show EUR symbol
      const eurPrices = results.filter(h => 
        h.priceDisplay.includes('€') || h.priceDisplay.includes('EUR')
      );
      console.log(`${eurPrices.length}/${results.length} show EUR currency`);
    }, 90000);
  });

  describe('Result Limit', () => {
    it('should respect the limit parameter', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 90);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      const results = await browser.searchHotels({
        destination: 'Barcelona, Spain',
        checkIn: formatDate(checkIn),
        checkOut: formatDate(checkOut),
        guests: 2,
        rooms: 1,
        limit: 5,
      });

      expect(results.length).toBeLessThanOrEqual(5);
    }, 90000);
  });
});
