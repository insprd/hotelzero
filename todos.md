# HotelZero - Improvement Roadmap

## Quick Wins (< 2 hours each)
- [x] Fix version mismatch (package.json vs index.ts)
- [x] Add `minPrice` filter
- [x] Add `currency` parameter
- [x] Add `sortBy` parameter (price, rating, distance)
- [x] Add thumbnail URLs in search results
- [x] Add availability status detection ("Only 2 left!")
- [x] Move debug files out of src/
- [x] Add `.npmignore` for dev files

## High Value Features
- [ ] Pagination support (access more than ~25 results)
- [ ] Compare hotels tool (side-by-side comparison)
- [ ] Retry logic with exponential backoff
- [ ] Rate limiting protection

## New Tools
- [ ] `compare_hotels` - Compare 2-3 hotels side-by-side
- [ ] `check_availability` - Quick availability check
- [ ] `get_reviews` - Fetch hotel reviews
- [ ] `get_price_calendar` - Find cheapest dates

## Robustness
- [ ] CAPTCHA detection with graceful failure
- [ ] Proxy support for heavy usage
- [ ] User agent rotation
- [ ] Cookie/session management

## Code Quality
- [ ] Add automated test suite (Jest/Vitest)
- [ ] Structured error messages with error types
- [ ] Add logging framework (pino/winston)
- [ ] TypeScript strict mode improvements

## Documentation
- [ ] Add CHANGELOG.md
- [ ] Add CONTRIBUTING.md
- [ ] Expand troubleshooting section
- [ ] Document full API response schema
