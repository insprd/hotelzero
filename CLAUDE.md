# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

HotelZero is an MCP (Model Context Protocol) server that searches hotels on Booking.com using Playwright browser automation. It provides 80+ filters for precise hotel searches and implements anti-bot detection measures including user agent rotation, session persistence, and proxy support.

## Development Commands

```bash
# Build
npm run build              # Compile TypeScript to dist/

# Development
npm run dev                # Run server in development mode with tsx

# Testing
npm test                   # Run all tests with vitest
npm run test:watch         # Run tests in watch mode
npm run test:ui            # Open vitest UI
npm run test:search        # Run search tests only
npm run test:details       # Run hotel details tests only
npm run test:reviews       # Run reviews tests only
npm run test:selectors     # Run selector tests only
npm run test:calendar      # Run price calendar tests only

# Production
npm start                  # Run the built server (requires build first)
```

## Environment Variables

- `HOTELZERO_PROXY`: Proxy server URL (HTTP or SOCKS5, with optional auth)
- `HOTELZERO_LOG_LEVEL`: Log verbosity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`)
- `HOTELZERO_SESSION_PATH`: Custom session file location (default: `~/.hotelzero/session.json`, empty string to disable)

## Architecture

### Core Components

**src/index.ts** - MCP server implementation
- Defines 8 MCP tools: `find_hotels`, `search_hotels`, `get_hotel_details`, `check_availability`, `get_reviews`, `get_price_calendar`, `compare_hotels`, `get_hotel_images`
- Implements Zod schemas for input validation
- Handles tool routing and error formatting
- Server runs on stdio transport for MCP communication

**src/browser.ts** - Playwright automation engine
- `HotelBrowser` class manages browser lifecycle and session persistence
- Filter code mappings: 20+ categories mapping friendly names to Booking.com's `nflt` URL parameters
- User agent rotation: 14 realistic browser profiles
- Session management: Saves/loads cookies and localStorage to reduce CAPTCHA challenges
- Retry logic: Exponential backoff with jitter for transient failures
- Custom error types: `HotelSearchError` with error codes and retryable flags

**src/logger.ts** - Structured logging
- Pino-based logging to stderr (avoids interfering with stdio MCP transport)
- Child loggers for `browser` and `server` modules
- Configurable via `HOTELZERO_LOG_LEVEL` environment variable

### Filter System

Filters are applied via Booking.com's URL parameter system. The `FILTER_CODES` object in `browser.ts` maps user-friendly filter names to internal codes:

```typescript
// Example mappings
beachfront: true      → ht_beach=1
freeWifi: true        → hotelfacility=107
fitness: true         → popular_activities=11
minRating: 8          → review_score=80
propertyType: 'hotel' → ht_id=204
```

Filters are combined into the `nflt` URL parameter. Client-side scoring ranks results based on filter match quality.

### Anti-Bot Detection

1. **User Agent Rotation**: Random selection from 14 realistic user agents on each browser session
2. **Session Persistence**: Saves cookies and localStorage after each successful request to maintain "trusted user" status
3. **Proxy Support**: Configurable HTTP/SOCKS5 proxy with authentication
4. **Headless Detection**: Disabled automation flags via Playwright context options
5. **Retry with Backoff**: Exponential backoff for rate limit/network errors

### Sponsored Ad Filtering

Native ads are detected and excluded by checking for:
- `nad_` tracking parameter in URLs (native ad tracking)
- Explicit "Ad", "Sponsored", or "Promoted" labels in HTML

## TypeScript Configuration

- Target: ES2022 with NodeNext modules
- **`noUncheckedIndexedAccess: true`**: All array/object index access returns `T | undefined`
- Strict mode enabled
- Declaration files generated in `dist/`

When working with arrays or objects that use bracket notation (e.g., `array[0]`, `obj[key]`), the result type will include `undefined`. Always handle this case:

```typescript
// WRONG
const item = items[0];
item.property; // Error: item is possibly undefined

// CORRECT
const item = items[0];
if (item) {
  item.property; // OK
}
// OR
const item = items[0]!; // Only if you're certain it exists
```

## Testing Strategy

Tests are integration tests that hit live Booking.com:
- **Network dependency**: Tests require internet connection and can fail if Booking.com blocks requests
- **Rate limiting**: Wait 5-10 minutes between full test suite runs to avoid IP blocks
- **Selector brittleness**: Booking.com may change their HTML structure, breaking selectors
- **Test timeouts**: Set to 60-90 seconds to allow for page loads and scrolling

When modifying selectors or scraping logic, run relevant test suite to verify:
```bash
npm run test:search    # For search result extraction
npm run test:details   # For hotel detail page parsing
npm run test:reviews   # For review extraction
```

## Common Development Patterns

### Adding a New Filter

1. Find the filter code on Booking.com by inspecting URLs with the filter enabled
2. Add to appropriate category in `FILTER_CODES` in `browser.ts`
3. Add to `HotelFilters` interface type
4. Add to Zod schema in `index.ts` (`FindHotelsSchema`)
5. Update scoring logic in `calculateMatchScore()` if needed

### Modifying Selectors

Selectors are concentrated in extraction functions:
- `extractHotelResults()` - Search result cards
- `extractHotelDetails()` - Detail page data
- `extractReviews()` - Review list and ratings
- `extractRoomOptions()` - Availability/pricing

Use `waitForSelector()` with appropriate timeouts. Test changes with `npm run test:selectors`.

### Handling New Error Scenarios

1. Add error code to `ErrorCodes` object in `browser.ts`
2. Throw `HotelSearchError` with the code and `retryable` flag
3. Error will be caught and formatted in `index.ts` tool handlers
4. Update error handling documentation in README if user-facing

## Browser Automation Details

- **Browser**: Chromium (via Playwright)
- **Headless**: Configurable (default: true)
- **Auto-scrolling**: Loads additional results by scrolling to bottom
- **Popup handling**: Dismisses cookie banners and sign-in modals automatically
- **Timeouts**: 30s for navigation, 10s for selectors
- **Context**: Persistent across requests when session saving enabled

## MCP Tool Architecture

Each tool follows this pattern:
1. Validate input with Zod schema
2. Call corresponding `HotelBrowser` method
3. Format successful results or errors
4. Return MCP tool response with `content: [{ type: "text", text: string }]`

Tools communicate via stdio transport, so all logging must go to stderr (handled by logger.ts).
