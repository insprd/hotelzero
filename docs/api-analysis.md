# Booking.com API Analysis

## Summary

This document captures our findings from investigating Booking.com's APIs.

## Key Finding: Two Data Sources

### 1. Search Results (Apollo Cache)
**Source**: `__caplaDataStore.apollo.cache.data.data.ROOT_QUERY.searchQueries`

Contains **full pricing and room block data** for hotels in search results:

```typescript
interface SearchResult {
  displayName: { text: string };
  basicPropertyData: {
    pageName: string;
    location: { countryCode: string };
    reviews: { totalScore: number; reviewsCount: number };
    photos: { main: { highResJpegUrl: { relativeUrl: string } } };
  };
  priceDisplayInfoIrene: {
    displayPrice: {
      amountPerStay: { amount: string; amountUnformatted: number; currency: string };
    };
    averagePricePerNight: { amountUnformatted: number };
    priceBeforeDiscount?: { amountPerStay: { amountUnformatted: number } };
    discounts: Array<{ name: string; amount: { amountUnformatted: number } }>;
  };
  blocks: Array<{
    blockId: {
      roomId: string;
      mealPlanId: number;
      policyGroupId: string;
      bundleId: number;
    };
    finalPrice: { amount: number; currency: string };
    freeCancellationUntil?: string;
  }>;
  matchingUnitConfigurations: {
    unitConfigurations: Array<{
      name: string;
      unitId: number;
      bedConfigurations: Array<{
        beds: Array<{ count: number; type: number }>;
      }>;
    }>;
  };
}
```

### 2. Hotel Page (Server-Rendered + GraphQL)
**Room pricing**: Server-rendered HTML with `data-*` attributes
**Room facilities**: GraphQL via `RoomPageDesktopRDS` operation

## GraphQL Operations Available

| Operation | Data Provided |
|-----------|---------------|
| `RoomPageDesktopRDS` | Room facilities (TV, AC, bathroom, etc.) by room ID |
| `Facilities` | Property-level facilities |
| `PropertyFaq` | FAQ questions and answers |
| `PropertySurroundingsBlockDesktop` | Nearby restaurants, landmarks, transport |
| `Bundles` | Value-add packages (late checkout, etc.) |
| `reviewScores` | Review score breakdown by category |

## Room Pricing Data

### On Search Results Page
- Available via Apollo cache
- Contains `blocks` array with individual rate options
- Each block has: `roomId`, `mealPlanId`, `finalPrice`, `freeCancellationUntil`
- Also has `matchingUnitConfigurations` with bed type info

### On Hotel Page
- **NOT available via GraphQL**
- Must extract from HTML `data-*` attributes:
  - `data-block-id`: `{roomTypeId}_{ratePlanId}_{...}_{bundleId}`
  - `data-hotel-rounded-price`: Price in base currency
  - `data-fltrs`: JSON with `breakfast_included`, `bed_count`

## Recommendations

### To Make Less Brittle

1. **For Search Results**: Already using Apollo cache (good!)
   - Continue using `extractHotelsFromAPI()` method
   - This is stable since it uses structured data

2. **For Hotel Room Availability**: 
   - Current: DOM scraping with `data-*` attributes (semi-stable)
   - Better: Use search API with hotel name filter to get room blocks
   - Alternative: Intercept GraphQL `roomTable` query if it exists

3. **For Hotel Details**:
   - Use `RoomPageDesktopRDS` for room facilities
   - Use `Facilities` for property facilities
   - Use `PropertyFaq` for check-in/check-out times, breakfast info
   - Use `PropertySurroundingsBlockDesktop` for nearby POIs

## GraphQL Endpoint

```
POST https://www.booking.com/dml/graphql
```

### Required Headers
```
x-booking-topic: capla_browser_b-property-web-property-page
x-booking-context-action-name: hotel
apollographql-client-name: b-property-web-property-page_rust
x-booking-csrf-token: <JWT token from page>
```
