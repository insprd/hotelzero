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

## High Value Features
- [ ] Pagination support (access more than ~25 results) - Partially done via `limit`

## New Tools
- [ ] `get_reviews` - Fetch hotel reviews
- [ ] `get_price_calendar` - Find cheapest dates

## Robustness
- [ ] Proxy support for heavy usage
- [ ] User agent rotation
- [ ] Cookie/session management

## Code Quality
- [ ] Add automated test suite (Jest/Vitest)
- [ ] Add logging framework (pino/winston)
- [ ] TypeScript strict mode improvements

## Documentation
- [ ] Add CHANGELOG.md
- [ ] Add CONTRIBUTING.md
- [ ] Expand troubleshooting section
- [ ] Document full API response schema
