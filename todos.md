# HotelZero - Improvement Roadmap

## Completed (v1.1.0)
- [x] Fix version mismatch (package.json vs index.ts)
- [x] Add `minPrice` filter
- [x] Add `currency` parameter
- [x] Add `sortBy` parameter (price, rating, distance)
- [x] Add thumbnail URLs in search results
- [x] Add availability status detection ("Only 2 left!")
- [x] Move debug files out of src/
- [x] Add `.npmignore` for dev files

## Completed (v1.2.0)
- [x] Add retry logic with exponential backoff
- [x] Add rate limiting protection (2s minimum between requests)
- [x] Add CAPTCHA detection with helpful error messages
- [x] Add structured error types (TIMEOUT, NETWORK_ERROR, BLOCKED, etc.)

## Completed (v1.3.0)
- [x] Add `limit` parameter for pagination (fetches more results via scroll)

## Completed (v1.4.0)
- [x] Add `compare_hotels` tool - Compare 2-3 hotels side-by-side

## Completed (v1.5.0)
- [x] Add `check_availability` tool - Quick availability check for specific dates

## Completed (v1.6.0)
- [x] Add `get_reviews` tool - Fetch hotel reviews with filtering and sorting

## Completed (v1.7.0)
- [x] Add `get_price_calendar` tool - Find cheapest dates across a date range

## Completed (v1.8.0)
- [x] Proxy support for heavy usage via HOTELZERO_PROXY environment variable

## Completed (v1.9.0)
- [x] Add automated test suite (Vitest)
  - [x] Selector health check tests (tests/selectors.test.ts)
  - [x] Search integration tests (tests/search.test.ts)
  - [x] Hotel details tests (tests/details.test.ts)
  - [x] Reviews tests (tests/reviews.test.ts)
  - [x] Price calendar tests (tests/price-calendar.test.ts)

## Completed (v1.10.0)
- [x] User agent rotation (random selection from 14 realistic browser profiles)

## Completed (v1.11.0)
- [x] Add pino structured logging framework
- [x] HOTELZERO_LOG_LEVEL environment variable for log verbosity control

## Completed (v1.12.0)
- [x] Cookie/session persistence via Playwright storageState
- [x] Auto-save sessions after successful requests
- [x] HOTELZERO_SESSION_PATH environment variable for custom session location

## Completed (v1.13.0)
- [x] Enable `noUncheckedIndexedAccess` TypeScript compiler option
- [x] Fix all array index access patterns for stricter type safety

## Robustness
- [x] Proxy support for heavy usage
- [x] User agent rotation
- [x] Cookie/session management

## Code Quality
- [x] Add automated test suite (Jest/Vitest)
- [x] Add logging framework (pino)
- [x] TypeScript strict mode improvements (noUncheckedIndexedAccess)

## Documentation
- [x] Add CHANGELOG.md
- [ ] Add CONTRIBUTING.md
- [ ] Expand troubleshooting section
- [ ] Document full API response schema
