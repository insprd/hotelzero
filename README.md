# HotelZero

An MCP (Model Context Protocol) server that searches hotels on Booking.com using Playwright browser automation. Features 80+ filter options for precise hotel searches.

## Features

- **Comprehensive Filtering**: 80+ filters covering property types, amenities, accessibility, activities, and more
- **Real Booking.com Data**: Uses actual Booking.com filter codes reverse-engineered from their URL parameters
- **Sponsored Ad Filtering**: Automatically excludes paid/promoted listings (native ads with `nad_` tracking)
- **Smart Scoring**: Results are scored and ranked by how well they match your criteria
- **Match Transparency**: Each result shows why it matched your filters

## Installation

```bash
npm install -g hotelzero

# Install Playwright browser (Chromium)
npx playwright install chromium
```

Or run directly with npx:

```bash
npx hotelzero
```

## Proxy Support

For heavy usage or to avoid IP blocks, you can configure a proxy server via the `HOTELZERO_PROXY` environment variable:

```bash
# HTTP proxy
HOTELZERO_PROXY=http://proxy.example.com:8080 npx hotelzero

# HTTP proxy with authentication
HOTELZERO_PROXY=http://user:pass@proxy.example.com:8080 npx hotelzero

# SOCKS5 proxy
HOTELZERO_PROXY=socks5://proxy.example.com:1080 npx hotelzero

# SOCKS5 proxy with authentication
HOTELZERO_PROXY=socks5://user:pass@proxy.example.com:1080 npx hotelzero
```

When a proxy is configured, you'll see confirmation in the startup logs:
```
Proxy enabled: http://proxy.example.com:8080
HotelZero v1.8.0 running on stdio
```

## Logging

HotelZero uses structured logging via [pino](https://github.com/pinojs/pino). Logs are written to stderr to avoid interfering with the MCP stdio transport.

### Log Level

Control log verbosity with the `HOTELZERO_LOG_LEVEL` environment variable:

```bash
# Available levels: trace, debug, info, warn, error, fatal, silent
# Default: info

# Debug mode - verbose output for troubleshooting
HOTELZERO_LOG_LEVEL=debug npx hotelzero

# Silent mode - no logs
HOTELZERO_LOG_LEVEL=silent npx hotelzero

# Error only - minimal output
HOTELZERO_LOG_LEVEL=error npx hotelzero
```

### Log Output

Logs are JSON-formatted for easy parsing:

```json
{"level":"info","time":"2026-02-15T12:00:00.000Z","service":"hotelzero","module":"server","version":"1.11.0","transport":"stdio","msg":"HotelZero server started"}
{"level":"info","time":"2026-02-15T12:00:01.000Z","service":"hotelzero","module":"browser","msg":"Browser initialized"}
{"level":"info","time":"2026-02-15T12:00:02.000Z","service":"hotelzero","module":"browser","destination":"Paris","msg":"Starting hotel search"}
```

## Session Persistence

HotelZero automatically saves browser session data (cookies, localStorage) to reduce bot detection and avoid repeated CAPTCHA challenges.

### How It Works

- Sessions are automatically saved after each successful request
- On startup, the previous session is loaded if available
- Default session location: `~/.hotelzero/session.json`

### Custom Session Path

Use `HOTELZERO_SESSION_PATH` to specify a custom location:

```bash
# Custom session file location
HOTELZERO_SESSION_PATH=/path/to/session.json npx hotelzero

# Disable session persistence (use empty string)
HOTELZERO_SESSION_PATH="" npx hotelzero
```

### Clearing Sessions

If you experience issues, you can delete the session file:

```bash
rm ~/.hotelzero/session.json
```

## Quick Start

### Run as MCP Server

Add to your MCP client configuration (e.g., Claude Desktop, OpenCode):

```json
{
  "mcpServers": {
    "hotelzero": {
      "command": "npx",
      "args": ["hotelzero"]
    }
  }
}
```

## Available Tools

### `find_hotels`

Search for hotels with comprehensive filtering. This is the primary tool with all 80+ filter options.

**Example:**
```json
{
  "destination": "San Juan, Puerto Rico",
  "checkIn": "2026-03-07",
  "checkOut": "2026-03-14",
  "beachfront": true,
  "freeWifi": true,
  "fitness": true,
  "minRating": 8
}
```

### `search_hotels`

Basic hotel search without filters. Use this for simple queries when you don't need specific criteria.

**Example:**
```json
{
  "destination": "Paris, France",
  "checkIn": "2026-06-01",
  "checkOut": "2026-06-05",
  "guests": 2,
  "rooms": 1
}
```

### `get_hotel_details`

Get detailed information about a specific hotel including full amenity list, description, and photos.

**Example:**
```json
{
  "url": "https://www.booking.com/hotel/pr/condado-vanderbilt.html"
}
```

---

## Complete Filter Reference

### Basic Search Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destination` | string | Yes | City or location (e.g., "San Juan, Puerto Rico") |
| `checkIn` | string | Yes | Check-in date (YYYY-MM-DD) |
| `checkOut` | string | Yes | Check-out date (YYYY-MM-DD) |
| `guests` | number | No | Number of guests (default: 2) |
| `rooms` | number | No | Number of rooms (default: 1) |
| `currency` | string | No | Currency code (USD, EUR, GBP, JPY, etc.) Default: USD |
| `sortBy` | enum | No | Sort results: `popularity`, `price_lowest`, `price_highest`, `rating`, `distance` |

### Rating & Price

| Filter | Type | Description |
|--------|------|-------------|
| `minRating` | number | Minimum review score: 6=Pleasant, 7=Good, 8=Very Good, 9=Wonderful |
| `minPrice` | number | Minimum price per night |
| `maxPrice` | number | Maximum price per night |

### Property Type

| Filter | Type | Options |
|--------|------|---------|
| `propertyType` | enum | `hotel`, `apartment`, `resort`, `villa`, `vacation_home`, `hostel`, `bnb`, `guesthouse`, `homestay`, `motel`, `inn`, `lodge`, `chalet`, `campground`, `glamping`, `boat`, `capsule`, `ryokan`, `riad`, `country_house`, `farm_stay` |
| `starRating` | number | 1, 2, 3, 4, or 5 stars |

### Beach & Location

| Filter | Type | Description |
|--------|------|-------------|
| `beachfront` | boolean | Property is directly on the beach |
| `beachAccess` | boolean | Property has beach access |
| `oceanView` | boolean | Room with ocean/sea view |
| `maxDistanceFromCenter` | enum | `half_mile`, `1_mile`, `2_miles` |

### Hotel Facilities

| Filter | Description |
|--------|-------------|
| `freeWifi` | Free WiFi throughout property |
| `pool` | Swimming pool |
| `spa` | Spa/wellness center |
| `fitness` | Fitness center/gym |
| `parking` | Parking available |
| `restaurant` | On-site restaurant |
| `bar` | On-site bar/lounge |
| `roomService` | 24-hour front desk/room service |
| `airportShuttle` | Airport shuttle service |
| `hotTub` | Hot tub/Jacuzzi |
| `sauna` | Sauna |
| `garden` | Garden |
| `terrace` | Terrace |
| `nonSmokingRooms` | Non-smoking rooms available |
| `familyRooms` | Family rooms |
| `evCharging` | Electric vehicle charging station |
| `casino` | Casino |
| `golf` | Golf course nearby (within 2 miles) |
| `tennis` | Tennis court |
| `bbqFacilities` | BBQ facilities |
| `laundry` | Laundry service |
| `concierge` | Concierge service |
| `businessCenter` | Business center |

### Room Facilities

| Filter | Description |
|--------|-------------|
| `airConditioning` | Air conditioning |
| `kitchen` | Kitchen or kitchenette |
| `balcony` | Private balcony |
| `privatePool` | Private pool |
| `privateBathroom` | Private bathroom |
| `bath` | Bathtub |
| `tv` | Television |
| `minibar` | Minibar |
| `safe` | In-room safe |
| `washingMachine` | Washing machine in unit |
| `soundproofing` | Soundproofed rooms |

### Bed Type

| Filter | Options |
|--------|---------|
| `bedType` | `king`, `queen`, `double`, `twin`, `single` |

### Meal Plans

| Filter | Description |
|--------|-------------|
| `breakfast` | Breakfast included in rate |
| `allInclusive` | All-inclusive package |
| `selfCatering` | Self-catering with kitchen amenities |

### Stay Type & Policies

| Filter | Description |
|--------|-------------|
| `petFriendly` | Pets allowed |
| `adultsOnly` | Adults-only property |
| `lgbtqFriendly` | LGBTQ+ friendly (Booking.com Travel Proud) |
| `freeCancellation` | Free cancellation available |
| `noPrepayment` | No prepayment required |
| `noBookingFee` | Book without credit card |

### Sustainability

| Filter | Description |
|--------|-------------|
| `sustainabilityCertified` | Has sustainability certification |

### Activities

| Filter | Description |
|--------|-------------|
| `snorkeling` | Snorkeling available |
| `diving` | Diving/scuba available |
| `fishing` | Fishing available |
| `hiking` | Hiking trails nearby |
| `cycling` | Cycling/biking available |
| `skiing` | Skiing nearby |
| `waterSports` | Water sports available |
| `horseRiding` | Horse riding available |

### Accessibility - Property Level

| Filter | Description |
|--------|-------------|
| `grabRails` | Grab rails in bathroom |
| `raisedToilet` | Raised toilet |
| `loweredSink` | Lowered sink |
| `braille` | Braille signage |
| `tactileSigns` | Tactile signs |
| `auditoryGuidance` | Auditory guidance |

### Accessibility - Room Level

| Filter | Description |
|--------|-------------|
| `wheelchairAccessible` | Entire unit wheelchair accessible |
| `groundFloor` | Ground floor unit available |
| `elevatorAccess` | Upper floors accessible by elevator |
| `walkInShower` | Walk-in shower |
| `rollInShower` | Roll-in shower (wheelchair accessible) |
| `showerChair` | Shower chair available |

### Hotel Chains

| Filter | Options |
|--------|---------|
| `hotelChain` | `marriott`, `hilton`, `hyatt`, `ihg`, `wyndham`, `best_western`, `accor`, `choice`, `radisson`, `ritz_carlton`, `four_seasons`, `fairmont`, `sheraton`, `westin`, `w_hotels`, `courtyard`, `residence_inn`, `hampton`, `embassy_suites`, `doubletree` |

---

## Example Queries

### Beach Vacation in Puerto Rico

```json
{
  "destination": "San Juan, Puerto Rico",
  "checkIn": "2026-03-07",
  "checkOut": "2026-03-14",
  "beachfront": true,
  "freeWifi": true,
  "fitness": true,
  "pool": true,
  "minRating": 8
}
```

### Luxury Ski Resort

```json
{
  "destination": "Aspen, Colorado",
  "checkIn": "2026-01-15",
  "checkOut": "2026-01-22",
  "propertyType": "resort",
  "starRating": 5,
  "skiing": true,
  "spa": true,
  "hotTub": true,
  "minRating": 9
}
```

### Family Beach Trip with All-Inclusive

```json
{
  "destination": "Cancun, Mexico",
  "checkIn": "2026-07-01",
  "checkOut": "2026-07-08",
  "guests": 4,
  "rooms": 2,
  "beachfront": true,
  "allInclusive": true,
  "familyRooms": true,
  "pool": true,
  "freeCancellation": true
}
```

### Accessible City Center Hotel

```json
{
  "destination": "London, UK",
  "checkIn": "2026-04-01",
  "checkOut": "2026-04-05",
  "maxDistanceFromCenter": "half_mile",
  "wheelchairAccessible": true,
  "elevatorAccess": true,
  "walkInShower": true,
  "freeWifi": true
}
```

### Pet-Friendly Road Trip Stop

```json
{
  "destination": "Portland, Oregon",
  "checkIn": "2026-05-10",
  "checkOut": "2026-05-12",
  "petFriendly": true,
  "parking": true,
  "freeCancellation": true,
  "maxPrice": 200
}
```

### Digital Nomad Long Stay

```json
{
  "destination": "Lisbon, Portugal",
  "checkIn": "2026-06-01",
  "checkOut": "2026-06-30",
  "propertyType": "apartment",
  "kitchen": true,
  "freeWifi": true,
  "washingMachine": true,
  "maxDistanceFromCenter": "1_mile",
  "maxPrice": 150
}
```

### Romantic Getaway

```json
{
  "destination": "Santorini, Greece",
  "checkIn": "2026-09-15",
  "checkOut": "2026-09-20",
  "adultsOnly": true,
  "oceanView": true,
  "privatePool": true,
  "breakfast": true,
  "spa": true,
  "minRating": 9
}
```

### Japanese Cultural Experience

```json
{
  "destination": "Kyoto, Japan",
  "checkIn": "2026-04-01",
  "checkOut": "2026-04-07",
  "propertyType": "ryokan",
  "breakfast": true,
  "minRating": 8
}
```

### Eco-Friendly Adventure

```json
{
  "destination": "Costa Rica",
  "checkIn": "2026-02-01",
  "checkOut": "2026-02-08",
  "sustainabilityCertified": true,
  "hiking": true,
  "snorkeling": true,
  "diving": true
}
```

### Golf Trip

```json
{
  "destination": "Scottsdale, Arizona",
  "checkIn": "2026-03-01",
  "checkOut": "2026-03-05",
  "propertyType": "resort",
  "golf": true,
  "spa": true,
  "restaurant": true,
  "bar": true
}
```

---

## How It Works

### Server-Side Filtering

Filters are applied via Booking.com's `nflt` URL parameter using reverse-engineered filter codes. For example:

- `beachfront: true` adds `ht_beach=1`
- `freeWifi: true` adds `hotelfacility=107`
- `fitness: true` adds `popular_activities=11`
- `minRating: 8` adds `review_score=80`

### Client-Side Scoring

After fetching results, each hotel is scored based on how well it matches your criteria:

- **+20 points**: Beach-related filters when property mentions beach
- **+15 points**: Rating 9.0+ ("Excellent")
- **+10 points**: Each matched amenity (WiFi, pool, gym, etc.)
- **+5 points**: 500+ reviews (trustworthiness bonus)

Results are sorted by match score, so the best matches appear first.

### Sponsored Ad Filtering

Booking.com injects paid "native ads" into search results. These are identified and excluded by:

1. Detecting `nad_` (native ad tracking) in the hotel card HTML or links
2. Checking for explicit "Ad", "Sponsored", or "Promoted" labels

This ensures you only see organic results, not paid placements.

---

## Output Format

Each hotel result includes:

```
1. Hotel Name
   Price: $XXX per night
   Rating: X.X/10 Rating Text (XXX reviews)
   Location: X.X miles from center
   Amenities: Pool, Free WiFi, Gym, ...
   Match Score: XX
   Why it matches: Near beach, Has WiFi, Has gym, ...
   Book: https://www.booking.com/hotel/...
```

---

## Technical Details

### Architecture

```
src/
├── index.ts      # MCP server with tool definitions
├── browser.ts    # Playwright automation & filter mappings
└── test*.ts      # Test scripts
```

### Dependencies

- `@modelcontextprotocol/sdk` - MCP server SDK
- `playwright` - Browser automation
- `zod` - Schema validation

### Browser Configuration

- **Headless Mode**: Runs without visible browser window
- **Anti-Detection**: Custom user agent and disabled automation flags
- **User Agent Rotation**: Randomly selects from 14 realistic browser profiles (Chrome, Firefox, Safari, Edge) on each session
- **Auto-Scrolling**: Loads more results by scrolling the page
- **Popup Handling**: Automatically dismisses cookie banners and sign-in modals

### Filter Code Mappings

All Booking.com filter codes are mapped in `browser.ts`:

```typescript
const FILTER_CODES = {
  propertyType: { hotel: "ht_id=204", resort: "ht_id=206", ... },
  hotelfacility: { freeWifi: 107, pool: 433, spa: 54, ... },
  roomfacility: { airConditioning: 11, kitchen: 999, ... },
  popularActivities: { fitness: 11, golf: 12, skiing: 13, ... },
  chaincode: { marriott: 1080, hilton: 1078, ... },
  // ... 20+ filter categories
};
```

---

## Limitations

- **Rate Limiting**: Booking.com may rate-limit or block automated requests
- **Results Cap**: Returns ~25 results per search (first page + scroll load)
- **Price Accuracy**: Prices may vary based on availability and timing
- **Filter Availability**: Some filters may not apply to all destinations

---

## Troubleshooting

### "Browser not initialized"

Run `npx playwright install chromium` to install the browser.

```bash
npx playwright install chromium
```

If that doesn't work, try forcing a reinstall:
```bash
npx playwright install chromium --force
```

### No results returned

- **Check dates**: Ensure check-in/check-out dates are in the future
- **Verify destination**: Try more specific locations like "Paris, France" instead of just "Paris"
- **Reduce filters**: Too many filters can result in zero matches - try removing some
- **Check availability**: Some destinations may have no availability for your dates

### CAPTCHA or Access Denied

If you encounter CAPTCHA challenges:

1. **Wait 5-10 minutes** before retrying
2. **Check your session**: Delete the session file and try again
   ```bash
   rm ~/.hotelzero/session.json
   ```
3. **Use a proxy**: Consider configuring a proxy server (see [Proxy Support](#proxy-support))
4. **Reduce request frequency**: Avoid making many rapid requests

### Blocked by Booking.com

- **Rate limiting**: Wait a few minutes before retrying
- **Session issues**: Clear the session file (`rm ~/.hotelzero/session.json`)
- **IP blocked**: Use a proxy server or try from a different network
- **User agent rotation**: HotelZero rotates user agents automatically, but excessive use from one IP can still trigger blocks

### Proxy not working

- **Verify accessibility**: Test the proxy with `curl` first
  ```bash
  curl -x http://proxy:8080 https://www.booking.com
  ```
- **Check credentials**: Ensure username/password are URL-encoded if they contain special characters
- **Protocol support**: Ensure the proxy supports HTTPS connections
- **Connection timeout**: Some proxies may be slow - try a different one

### Prices or Data Missing

- **Dynamic loading**: Some data loads asynchronously; try increasing timeouts
- **Currency issues**: Specify currency explicitly with `currency: "USD"`
- **Regional differences**: Some properties may not show prices for certain regions

### Session Issues

If you experience inconsistent behavior:

```bash
# Clear the session and start fresh
rm ~/.hotelzero/session.json

# Or disable session persistence entirely
HOTELZERO_SESSION_PATH="" npx hotelzero
```

### Debug Mode

Enable debug logging to see detailed information:

```bash
HOTELZERO_LOG_LEVEL=debug npx hotelzero
```

This will show:
- URL being requested
- Filters being applied
- Number of results found
- Any errors or warnings

### Tests Failing

If you're running the test suite and tests fail:

1. **Network issues**: Tests hit live Booking.com - check your connection
2. **Rate limiting**: Wait a few minutes between test runs
3. **Selector changes**: Booking.com may have updated their HTML structure

---

## API Response Schema

### HotelResult (from `find_hotels` / `search_hotels`)

```typescript
interface HotelResult {
  name: string;                    // Hotel name
  price: number | null;            // Price per night as number (null if not shown)
  priceDisplay: string;            // Formatted price string (e.g., "$199")
  rating: number | null;           // Review score 0-10 (null if no reviews)
  ratingText: string;              // Rating description (e.g., "Excellent", "Very Good")
  reviewCount: number | null;      // Number of reviews (null if not shown)
  location: string;                // Neighborhood/area name
  distanceToCenter: string;        // Distance from center (e.g., "0.5 miles from center")
  amenities: string[];             // Detected amenities (e.g., ["Pool", "Free WiFi", "Spa"])
  highlights: string[];            // Special highlights (e.g., ["Free Cancellation"])
  link: string;                    // Full Booking.com URL for the hotel
  thumbnailUrl: string | null;     // Hotel thumbnail image URL (null if not available)
  availability: string | null;     // Availability status (e.g., "Only 2 rooms left!")
  matchScore?: number;             // Relevance score based on filters (only with filters)
  matchReasons?: string[];         // Why this hotel matched (only with filters)
}
```

### HotelDetails (from `get_hotel_details` / `compare_hotels`)

```typescript
interface HotelDetails {
  name: string;                    // Hotel name
  url: string;                     // Booking.com URL
  rating: number | null;           // Review score 0-10
  ratingText: string;              // Rating description
  reviewCount: number | null;      // Total number of reviews
  starRating: number | null;       // Official star rating 1-5
  address: string;                 // Full address
  description: string;             // Hotel description text
  highlights: string;              // Property highlights summary
  pricePerNight: number | null;    // Price per night as number
  priceDisplay: string;            // Formatted price per night
  totalPrice: string;              // Total stay price (formatted)
  checkInTime: string;             // Check-in time (e.g., "15:00")
  checkOutTime: string;            // Check-out time (e.g., "11:00")
  popularFacilities: string[];     // Top facilities list
  allFacilities: string[];         // Complete facilities list
  roomTypes: string[];             // Available room type names
  photos: string[];                // Photo URLs
  nearbyAttractions: string[];     // Nearby points of interest
  guestReviewHighlights: string[]; // Notable review excerpts
  locationInfo: string;            // Location description
}
```

### AvailabilityResult (from `check_availability`)

```typescript
interface AvailabilityResult {
  available: boolean;              // Whether rooms are available
  hotelName: string;               // Hotel name
  checkIn: string;                 // Check-in date (YYYY-MM-DD)
  checkOut: string;                // Check-out date (YYYY-MM-DD)
  guests: number;                  // Number of guests searched
  rooms: number;                   // Number of rooms searched
  roomOptions: RoomOption[];       // Available room types
  lowestPrice: number | null;      // Lowest price found
  lowestPriceDisplay: string;      // Formatted lowest price
  message: string;                 // Status message
  url: string;                     // Booking URL with dates
}

interface RoomOption {
  name: string;                    // Room type name
  price: number | null;            // Price as number
  priceDisplay: string;            // Formatted price
  sleeps: number | null;           // Maximum occupancy
  features: string[];              // Room features
  bedType: string;                 // Bed configuration
  cancellation: string;            // Cancellation policy
  breakfast: string;               // Meal plan info
}
```

### ReviewsResult (from `get_reviews`)

```typescript
interface ReviewsResult {
  hotelName: string;               // Hotel name
  overallRating: number | null;    // Overall score 0-10
  totalReviews: number;            // Total review count
  ratingBreakdown: RatingBreakdown; // Scores by category
  reviews: Review[];               // Individual reviews
  url: string;                     // Hotel URL
}

interface RatingBreakdown {
  staff: number | null;            // Staff rating
  facilities: number | null;       // Facilities rating
  cleanliness: number | null;      // Cleanliness rating
  comfort: number | null;          // Comfort rating
  valueForMoney: number | null;    // Value rating
  location: number | null;         // Location rating
  freeWifi: number | null;         // WiFi rating
}

interface Review {
  title: string;                   // Review title
  rating: number | null;           // Individual score 0-10
  date: string;                    // Review date
  travelerType: string;            // Traveler type (e.g., "Couple", "Family")
  country: string;                 // Reviewer's country
  stayDate: string;                // When they stayed
  roomType: string;                // Room they booked
  nightsStayed: string;            // Length of stay
  positive: string;                // Positive comments
  negative: string;                // Negative comments
}
```

### PriceCalendarResult (from `get_price_calendar`)

```typescript
interface PriceCalendarResult {
  hotelName: string;               // Hotel name
  startDate: string;               // Calendar start (YYYY-MM-DD)
  endDate: string;                 // Calendar end (YYYY-MM-DD)
  nights: number;                  // Number of nights checked
  currency: string;                // Currency code
  prices: DatePrice[];             // Price for each date
  lowestPrice: number | null;      // Lowest price in range
  lowestPriceDate: string | null;  // Date with lowest price
  highestPrice: number | null;     // Highest price in range
  highestPriceDate: string | null; // Date with highest price
  averagePrice: number | null;     // Average price
  url: string;                     // Hotel URL
}

interface DatePrice {
  date: string;                    // Date (YYYY-MM-DD)
  price: number | null;            // Price as number
  priceDisplay: string;            // Formatted price
  available: boolean;              // Whether available
  currency: string;                // Currency code
}
```

### Error Response

When an error occurs, the response includes:

```typescript
interface ErrorResponse {
  content: [{
    type: "text";
    text: string;                  // Error message with code and help text
  }];
  isError: true;
}
```

Error codes:
- `BROWSER_NOT_INITIALIZED` - Call init() first
- `NAVIGATION_FAILED` - Page load failed
- `RATE_LIMITED` - Too many requests
- `CAPTCHA_DETECTED` - CAPTCHA challenge encountered
- `NO_RESULTS` - Search returned no results
- `DESTINATION_NOT_FOUND` - Invalid destination
- `NETWORK_ERROR` - Connection issue
- `TIMEOUT` - Request timed out
- `BLOCKED` - Access denied by Booking.com

---

## License

MIT
