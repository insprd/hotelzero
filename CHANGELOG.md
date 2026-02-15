# Changelog

All notable changes to HotelZero will be documented in this file.

## [1.15.0] - 2026-02-15

### Added
- API-based data extraction from Booking.com's Apollo GraphQL cache (`window.__APOLLO_STATE__`)
- `extractHotelsFromAPI()` method for reliable data extraction without DOM scraping
- `searchHotelRates()` method for API-based hotel rate lookup
- New interfaces: `HotelRateFilters`, `HotelRateResult`, `RoomAmenityCategory`
- `docs/api-analysis.md` documenting the Apollo cache structure
- `CLAUDE.md` project documentation

### Changed
- Search now tries API extraction first, falls back to DOM scraping if unavailable
- Selector tests use clean URLs (stripped query params) for faster, more reliable tests
- Selector tests use `domcontentloaded` instead of `networkidle` for faster page loads

## [1.14.0] - 2026-02-15

### Added
- `CONTRIBUTING.md` with development setup, code style guidelines, and PR process
- Expanded troubleshooting section in README with detailed solutions for common issues
- Full API response schema documentation in README
  - `HotelResult` schema for search results
  - `HotelDetails` schema for detailed hotel info
  - `AvailabilityResult` and `RoomOption` schemas for availability checks
  - `ReviewsResult`, `Review`, and `RatingBreakdown` schemas for reviews
  - `PriceCalendarResult` and `DatePrice` schemas for price calendar
  - Error response format and error codes

## [1.13.0] - 2026-02-15

### Changed
- Enabled `noUncheckedIndexedAccess` TypeScript compiler option for stricter type safety
- Fixed all array/object index access to properly handle potentially undefined values
- Improved null safety throughout the codebase

## [1.12.0] - 2026-02-15

### Added
- Cookie/session persistence for improved bot detection evasion
- Sessions are automatically saved after successful requests
- `HOTELZERO_SESSION_PATH` environment variable to customize session file location
- Default session storage at `~/.hotelzero/session.json`
- `HotelBrowser.hasExistingSession()` static method to check for saved sessions
- `HotelBrowser.clearSession()` static method to clear saved session data

### Changed
- Browser context now reuses cookies and localStorage from previous sessions
- Reduced likelihood of CAPTCHA challenges through session continuity

## [1.11.0] - 2026-02-15

### Added
- Structured logging using pino
- `HOTELZERO_LOG_LEVEL` environment variable to control log verbosity
- Available log levels: trace, debug, info, warn, error, fatal, silent (default: info)
- Logs output to stderr to avoid interfering with MCP stdio transport
- Module-specific loggers for browser and server components

### Changed
- Replaced all `console.error` calls with structured pino logger

## [1.10.0] - 2026-02-15

### Added
- User agent rotation for improved bot detection evasion
- Pool of 14 realistic user agents across Chrome, Firefox, Safari, and Edge
- Random user agent selection on each browser session initialization
- `getUserAgent()` method to see current user agent
- `HotelBrowser.getAvailableUserAgents()` static method to list all user agents

## [1.9.0] - 2026-02-15

### Added
- Automated test suite using Vitest
  - Selector health check tests to detect Booking.com UI changes
  - Search integration tests
  - Hotel details and comparison tests
  - Reviews extraction tests
  - Price calendar tests
- Test scripts in package.json (`npm test`, `npm run test:selectors`, etc.)

### Changed
- Tests run sequentially to avoid rate limiting issues

## [1.8.0] - 2026-02-14

### Added
- Proxy support via `HOTELZERO_PROXY` environment variable
- Supports HTTP, HTTPS, and SOCKS5 proxies
- Optional authentication for proxies (`user:pass@host:port`)

## [1.7.0] - 2026-02-13

### Added
- `get_price_calendar` tool - Find cheapest dates across a date range
- Shows price per night for multiple consecutive dates
- Identifies lowest, highest, and average prices

## [1.6.0] - 2026-02-12

### Added
- `get_reviews` tool - Fetch hotel reviews with filtering and sorting
- Sort reviews by newest, oldest, highest rating, or lowest rating
- Extract rating breakdown by category (staff, cleanliness, location, etc.)

## [1.5.0] - 2026-02-11

### Added
- `check_availability` tool - Quick availability check for specific dates
- Returns room options and pricing for a specific hotel

## [1.4.0] - 2026-02-10

### Added
- `compare_hotels` tool - Compare 2-3 hotels side-by-side
- Extracts detailed information including facilities, photos, and ratings

## [1.3.0] - 2026-02-09

### Added
- `limit` parameter for pagination (fetches more results via scrolling)

## [1.2.0] - 2026-02-08

### Added
- Retry logic with exponential backoff
- Rate limiting protection (2s minimum between requests)
- CAPTCHA detection with helpful error messages
- Structured error types (TIMEOUT, NETWORK_ERROR, BLOCKED, etc.)

## [1.1.0] - 2026-02-07

### Added
- `minPrice` filter
- `currency` parameter for price display
- `sortBy` parameter (price, rating, distance)
- Thumbnail URLs in search results
- Availability status detection ("Only 2 left!")

### Changed
- Moved debug files out of src/
- Added `.npmignore` for dev files

### Fixed
- Version mismatch between package.json and index.ts

## [1.0.0] - 2026-02-06

### Added
- Initial release
- MCP server for searching hotels on Booking.com
- 80+ filter options
- Playwright-based browser automation
- `search_hotels` tool with comprehensive filtering
