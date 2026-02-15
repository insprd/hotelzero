# Contributing to HotelZero

Thank you for your interest in contributing to HotelZero! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/hotelzero.git
   cd hotelzero
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browser**
   ```bash
   npx playwright install chromium
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run tests**
   ```bash
   npm test
   ```

## Project Structure

```
hotelzero/
├── src/
│   ├── index.ts       # MCP server, tool definitions, request handlers
│   ├── browser.ts     # Playwright automation, filter mappings, scraping logic
│   └── logger.ts      # Pino logging configuration
├── tests/
│   ├── search.test.ts      # Search integration tests
│   ├── details.test.ts     # Hotel details & comparison tests
│   ├── reviews.test.ts     # Review extraction tests
│   ├── price-calendar.test.ts  # Price calendar tests
│   └── selectors.test.ts   # CSS selector health checks
├── dist/              # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

## Code Style

### TypeScript

- **Strict mode enabled** with `noUncheckedIndexedAccess`
- Always handle potential `undefined` from array indexing
- Use explicit types where inference isn't clear
- Prefer `interface` over `type` for object shapes

### Formatting

- Use consistent indentation (2 spaces)
- Keep lines under 120 characters when practical
- Use meaningful variable and function names

### Error Handling

Use the custom `HotelSearchError` class for errors that should be returned to users:

```typescript
throw new HotelSearchError(
  "Human-readable message",
  ErrorCodes.ERROR_CODE,
  true // retryable?
);
```

Available error codes:
- `BROWSER_NOT_INITIALIZED`
- `NAVIGATION_FAILED`
- `RATE_LIMITED`
- `CAPTCHA_DETECTED`
- `NO_RESULTS`
- `DESTINATION_NOT_FOUND`
- `NETWORK_ERROR`
- `TIMEOUT`
- `BLOCKED`

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run tests/search.test.ts

# Run tests in watch mode
npx vitest

# Type check only
npx tsc --noEmit
```

### Writing Tests

Tests are integration tests that hit the live Booking.com site. Keep these guidelines in mind:

1. **Use realistic test data** - Search for real destinations with future dates
2. **Be mindful of rate limits** - Tests should not make excessive requests
3. **Handle flakiness** - Web scraping tests can be flaky; use appropriate timeouts
4. **Test selector health** - Add selector checks in `selectors.test.ts` when adding new scraping logic

Example test structure:
```typescript
describe("Feature Name", () => {
  let browser: HotelBrowser;

  beforeAll(async () => {
    browser = new HotelBrowser();
    await browser.init(true);
  });

  afterAll(async () => {
    await browser.close();
  });

  it("should do something specific", async () => {
    const result = await browser.someMethod();
    expect(result).toBeDefined();
  });
});
```

## Adding New Features

### Adding a New Filter

1. **Add the filter code** in `browser.ts` under `FILTER_CODES`:
   ```typescript
   const FILTER_CODES = {
     hotelfacility: {
       newFilter: 123,  // Booking.com filter code
     },
   };
   ```

2. **Add to the `HotelFilters` interface** in `browser.ts`:
   ```typescript
   export interface HotelFilters {
     newFilter?: boolean;
   }
   ```

3. **Add URL building logic** in `buildBookingUrl()`:
   ```typescript
   if (filters.newFilter) nfltParts.push(`hotelfacility=${hotelFacilities.newFilter}`);
   ```

4. **Add to Zod schema** in `index.ts`:
   ```typescript
   const FindHotelsSchema = z.object({
     newFilter: z.boolean().optional().describe("Description"),
   });
   ```

5. **Add to input schema** for MCP tool definition

6. **Add client-side scoring** in `scoreAndFilterHotels()` if relevant

7. **Update README** with the new filter

### Adding a New Tool

1. **Define Zod schema** in `index.ts`
2. **Add tool definition** in `ListToolsRequestSchema` handler
3. **Add handler case** in `CallToolRequestSchema` handler
4. **Add formatting function** if needed
5. **Write tests** for the new tool
6. **Document in README**

## Finding Booking.com Filter Codes

To discover filter codes:

1. Go to Booking.com and perform a search
2. Apply the filter you want to add
3. Look at the URL `nflt` parameter
4. The filter codes are in format: `category=value`

Example URL with filters:
```
https://www.booking.com/searchresults.html?ss=Paris&nflt=hotelfacility%3D107%3Bhotelfacility%3D433
```
This has: `hotelfacility=107` (WiFi) and `hotelfacility=433` (Pool)

## Commit Guidelines

### Commit Message Format

Use conventional commits format:

```
type: description (vX.Y.Z)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/config changes

Examples:
```
feat: add ski resort filter (v1.14.0)
fix: handle missing price element in search results
docs: expand troubleshooting section
test: add selector health checks for review extraction
```

### Version Bumping

- **Patch** (1.0.X): Bug fixes, minor improvements
- **Minor** (1.X.0): New features, new filters, new tools
- **Major** (X.0.0): Breaking changes

When bumping versions, update:
1. `package.json` - `version` field
2. `src/index.ts` - Version in Server constructor and logger
3. `CHANGELOG.md` - Add version entry

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** following the guidelines above

3. **Run tests and type check**
   ```bash
   npm run build && npm test
   ```

4. **Commit your changes** with a descriptive message

5. **Push and create a PR**
   ```bash
   git push origin feature/my-feature
   ```

6. **PR Description** should include:
   - What the change does
   - Why it's needed
   - How to test it
   - Any breaking changes

## Troubleshooting Development Issues

### Browser Won't Launch

```bash
# Reinstall Playwright browsers
npx playwright install chromium --force
```

### Tests Timing Out

- Booking.com may be rate-limiting; wait a few minutes
- Check your network connection
- Try running a single test file

### TypeScript Errors

```bash
# Full type check with strict options
npx tsc --noEmit --noUncheckedIndexedAccess
```

### Selector Changes

Booking.com occasionally updates their HTML structure. If scraping breaks:

1. Open Booking.com in a browser
2. Inspect the element structure
3. Update selectors in `browser.ts`
4. Add/update selector health tests

## Questions?

- Open a GitHub issue for bugs or feature requests
- Check existing issues before creating new ones

Thank you for contributing!
