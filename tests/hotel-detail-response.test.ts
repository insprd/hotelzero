import { describe, expect, it } from 'vitest';
import { HotelBrowser } from '../src/browser.js';

const hotelUrl = 'https://www.booking.com/hotel/es/example.html';

describe('Hotel detail response compatibility', () => {
  it('keeps current metadata while filling the description missing from API data', async () => {
    const browser = new HotelBrowser();
    Object.assign(browser, {
      getHotelDetailsForComparison: async () => ({
        name: 'Example Hotel',
        description: '',
        allFacilities: ['WiFi'],
        photos: ['https://example.com/hotel.jpg'],
      }),
      page: { evaluate: async () => 'Hotel description from the property page' },
    });

    await expect(browser.getHotelDetails(hotelUrl)).resolves.toMatchObject({
      name: 'Example Hotel',
      description: 'Hotel description from the property page',
      facilities: ['WiFi'],
      photos: ['https://example.com/hotel.jpg'],
    });
  });

  it('preserves an existing description instead of replacing it with fallback data', async () => {
    const browser = new HotelBrowser();
    Object.assign(browser, {
      getHotelDetailsForComparison: async () => ({
        name: 'Example Hotel',
        description: 'Existing description',
        allFacilities: ['WiFi'],
        photos: [],
      }),
      page: {
        evaluate: async () => { throw new Error('Unnecessary page fallback'); },
      },
    });

    await expect(browser.getHotelDetails(hotelUrl)).resolves.toMatchObject({
      description: 'Existing description',
    });
  });
});
