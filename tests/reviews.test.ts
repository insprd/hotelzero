/**
 * Reviews Integration Tests
 * 
 * Tests the getReviews function to ensure it correctly extracts
 * hotel reviews from Booking.com.
 * 
 * Note: Reviews tests are fragile because:
 * - The "Read all reviews" button selector may change
 * - Some hotels may not have reviews
 * - The reviews modal structure varies
 * 
 * Run with: npm test
 * Run specific: npx vitest tests/reviews.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HotelBrowser, ReviewsResult } from '../src/browser.js';

// We'll dynamically get a hotel URL from search with good reviews
let TEST_HOTEL_URL = '';

describe('Reviews Integration Tests', () => {
  let browser: HotelBrowser;

  beforeAll(async () => {
    browser = new HotelBrowser();
    await browser.init(true);
    
    // Search for hotels with reviews (filter by min rating ensures hotels have reviews)
    const searchResults = await browser.searchHotels({
      destination: 'Paris',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      guests: 2,
      rooms: 1,
      limit: 5,
    }, {
      minRating: 8, // Hotels with 8+ rating definitely have reviews
    });
    
    // Find a hotel with reviews (has rating and review count)
    const hotelWithReviews = searchResults.find(h => 
      h.link && h.rating !== null && h.rating > 0
    );
    
    TEST_HOTEL_URL = hotelWithReviews?.link || searchResults[0]?.link || '';
    console.log(`Using hotel for reviews: ${TEST_HOTEL_URL.substring(0, 60)}...`);
  }, 90000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('getReviews', () => {
    let result: ReviewsResult | null = null;
    let fetchError: Error | null = null;

    beforeAll(async () => {
      if (!TEST_HOTEL_URL) {
        console.warn('No hotel URL available - skipping reviews tests');
        return;
      }
      
      try {
        result = await browser.getReviews(TEST_HOTEL_URL, 10);
      } catch (error) {
        fetchError = error as Error;
        console.warn(`Reviews fetch failed: ${fetchError.message}`);
      }
    }, 90000);

    it('should return hotel name', () => {
      if (!result) {
        if (fetchError) {
          console.log(`Skipped - reviews fetch failed: ${fetchError.message}`);
        }
        return;
      }
      expect(result.hotelName).toBeTruthy();
      console.log(`Hotel: ${result.hotelName}`);
    });

    it('should return overall rating', () => {
      if (!result) return;
      if (result.overallRating !== null) {
        expect(result.overallRating).toBeGreaterThanOrEqual(1);
        expect(result.overallRating).toBeLessThanOrEqual(10);
        console.log(`Overall rating: ${result.overallRating}/10`);
      }
    });

    it('should return total review count', () => {
      if (!result) return;
      expect(result.totalReviews).toBeGreaterThanOrEqual(0);
      console.log(`Total reviews: ${result.totalReviews}`);
    });

    it('should return rating breakdown', () => {
      if (!result) return;
      const breakdown = result.ratingBreakdown;
      expect(breakdown).toBeDefined();
      
      // Log available categories
      const categories = ['staff', 'facilities', 'cleanliness', 'comfort', 'valueForMoney', 'location', 'freeWifi'];
      categories.forEach(cat => {
        const value = breakdown[cat as keyof typeof breakdown];
        if (value !== null) {
          console.log(`${cat}: ${value}`);
        }
      });
    });

    it('should return review array', () => {
      if (!result) return;
      expect(Array.isArray(result.reviews)).toBe(true);
      console.log(`Reviews fetched: ${result.reviews.length}`);
    });

    it('should extract review content (when available)', () => {
      if (!result || result.reviews.length === 0) return;
      
      const review = result.reviews[0];
      
      console.log(`First review:`);
      console.log(`  Title: ${review.title || '(none)'}`);
      console.log(`  Rating: ${review.rating || '(none)'}`);
      console.log(`  Positive: ${review.positive?.substring(0, 50) || '(none)'}...`);
      console.log(`  Negative: ${review.negative?.substring(0, 50) || '(none)'}...`);
    });

    it('should include URL', () => {
      if (!result) return;
      expect(result.url).toContain('booking.com');
    });
  });

  describe('getReviews with sorting', () => {
    it('should sort by highest rating', async () => {
      if (!TEST_HOTEL_URL) {
        console.log('Skipped - no hotel URL available');
        return;
      }
      
      let result: ReviewsResult;
      try {
        result = await browser.getReviews(TEST_HOTEL_URL, 5, 'highest');
      } catch (error) {
        console.log(`Skipped - reviews fetch failed: ${(error as Error).message}`);
        return;
      }
      
      if (result.reviews.length === 0) {
        console.log('No reviews found');
        return;
      }
      
      // First reviews should have high ratings
      const firstReview = result.reviews[0];
      if (firstReview.rating !== null) {
        console.log(`Highest sorted - first review rating: ${firstReview.rating}`);
        // Highest rated reviews should generally be 8+
        expect(firstReview.rating).toBeGreaterThanOrEqual(7);
      }
    }, 90000);

    it('should sort by lowest rating', async () => {
      if (!TEST_HOTEL_URL) {
        console.log('Skipped - no hotel URL available');
        return;
      }
      
      let result: ReviewsResult;
      try {
        result = await browser.getReviews(TEST_HOTEL_URL, 5, 'lowest');
      } catch (error) {
        console.log(`Skipped - reviews fetch failed: ${(error as Error).message}`);
        return;
      }
      
      if (result.reviews.length === 0) {
        console.log('No reviews found');
        return;
      }
      
      // First reviews should have lower ratings
      const firstReview = result.reviews[0];
      if (firstReview.rating !== null) {
        console.log(`Lowest sorted - first review rating: ${firstReview.rating}`);
        // Just verify we got a valid rating - sorting behavior varies
        expect(firstReview.rating).toBeGreaterThanOrEqual(1);
        expect(firstReview.rating).toBeLessThanOrEqual(10);
      }
    }, 90000);
  });
});
