import { chromium, Browser, Page, BrowserContext } from "playwright";
import { browserLogger as logger } from "./logger.js";
import * as fs from "fs";
import * as path from "path";

// Session/cookie persistence configuration
const SESSION_PATH = process.env.HOTELZERO_SESSION_PATH || "";

/**
 * Get the default session file path
 * Uses ~/.hotelzero/session.json if no custom path is specified
 */
function getDefaultSessionPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(homeDir, ".hotelzero", "session.json");
}

/**
 * Get the session file path (custom or default)
 */
function getSessionPath(): string {
  return SESSION_PATH || getDefaultSessionPath();
}

// Proxy configuration
export interface ProxyConfig {
  server: string;           // Proxy server URL (e.g., "http://proxy.example.com:8080" or "socks5://proxy.example.com:1080")
  username?: string;        // Optional username for authenticated proxies
  password?: string;        // Optional password for authenticated proxies
}

// Custom error types for better error handling
export class HotelSearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "HotelSearchError";
  }
}

export const ErrorCodes = {
  BROWSER_NOT_INITIALIZED: "BROWSER_NOT_INITIALIZED",
  NAVIGATION_FAILED: "NAVIGATION_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  CAPTCHA_DETECTED: "CAPTCHA_DETECTED",
  NO_RESULTS: "NO_RESULTS",
  DESTINATION_NOT_FOUND: "DESTINATION_NOT_FOUND",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  BLOCKED: "BLOCKED",
  INVALID_PARAMS: "INVALID_PARAMS",
} as const;

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// User agent pool for rotation - realistic modern browsers across platforms
const USER_AGENTS = [
  // Chrome on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  // Chrome on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  // Firefox on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
  // Firefox on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:121.0) Gecko/20100101 Firefox/121.0",
  // Safari on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  // Edge on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
];

/**
 * Get a random user agent from the pool
 */
function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index] ?? USER_AGENTS[0]!;
}

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry non-retryable errors
      if (error instanceof HotelSearchError && !error.retryable) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 1000;
      const delay = Math.min(exponentialDelay + jitter, config.maxDelayMs);
      
      if (onRetry) {
        onRetry(attempt, lastError, delay);
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

export interface HotelSearchParams {
  destination: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guests: number;
  rooms: number;
  currency?: string; // Currency code (USD, EUR, GBP, etc.)
  sortBy?: "popularity" | "price_lowest" | "price_highest" | "rating" | "distance";
  limit?: number; // Max results to return (default: 25, max: 100)
}

// Comprehensive filter interface based on all Booking.com filter codes
export interface HotelFilters {
  // === Rating & Reviews ===
  minRating?: number; // 6, 7, 8, or 9 (Pleasant, Good, Very Good, Wonderful)
  
  // === Price ===
  minPrice?: number; // Minimum price per night
  maxPrice?: number; // Maximum price per night
  
  // === Property Type (ht_id) ===
  propertyType?: 
    | "hotel"           // 204
    | "apartment"       // 201
    | "resort"          // 206
    | "villa"           // 213
    | "vacation_home"   // 220
    | "hostel"          // 203
    | "bnb"             // 208 - Bed and Breakfast
    | "guesthouse"      // 216
    | "homestay"        // 222
    | "motel"           // 205
    | "inn"             // 207
    | "lodge"           // 221
    | "chalet"          // 228
    | "campground"      // 214
    | "glamping"        // 224 - Luxury tents
    | "boat"            // 215
    | "capsule"         // 225
    | "ryokan"          // 218 - Japanese inn
    | "riad"            // 226 - Moroccan house
    | "country_house"   // 223
    | "farm_stay";      // 210
  
  // === Star Rating (class) ===
  starRating?: 1 | 2 | 3 | 4 | 5;
  
  // === Beach & Location ===
  beachfront?: boolean;        // ht_beach=1
  beachAccess?: boolean;       // popular_activities=302
  oceanView?: boolean;         // roomfacility=108 (Sea view)
  
  // === Hotel Facilities (hotelfacility) ===
  freeWifi?: boolean;          // 107
  pool?: boolean;              // 433 - Swimming pool
  spa?: boolean;               // 54
  fitness?: boolean;           // Popular activities: 11
  parking?: boolean;           // 2
  freeParking?: boolean;       // 2 (same code, Booking shows as "Parking")
  restaurant?: boolean;        // 3
  bar?: boolean;               // 8
  roomService?: boolean;       // 5 - 24-hour front desk
  airportShuttle?: boolean;    // 17
  hotTub?: boolean;            // 63 - Hot tub/Jacuzzi
  sauna?: boolean;             // 79
  garden?: boolean;            // 104
  terrace?: boolean;           // 6
  nonSmokingRooms?: boolean;   // 16
  familyRooms?: boolean;       // 28
  disabledFacilities?: boolean; // 25
  evCharging?: boolean;        // 182 - Electric vehicle charging
  golf?: boolean;              // popular_activities=12 (within 2 miles)
  tennis?: boolean;            // 90
  casino?: boolean;            // 78
  bbqFacilities?: boolean;     // 106
  laundry?: boolean;           // 52
  concierge?: boolean;         // 118
  currencyExchange?: boolean;  // 91
  businessCenter?: boolean;    // 10
  meetingRooms?: boolean;      // 126
  
  // === Room Facilities (roomfacility) ===
  airConditioning?: boolean;   // 11
  kitchen?: boolean;           // 999 - Kitchen/Kitchenette
  balcony?: boolean;           // 17
  privatePool?: boolean;       // 93
  privateBathroom?: boolean;   // 38
  bath?: boolean;              // 67 - Bathtub
  tv?: boolean;                // 75
  coffeemaker?: boolean;       // 999 (part of kitchen)
  minibar?: boolean;           // 6
  safe?: boolean;              // 14
  washingMachine?: boolean;    // 98
  soundproofing?: boolean;     // 133
  
  // === Bed Type (tdb) ===
  bedType?: 
    | "king"           // 6
    | "queen"          // 5
    | "double"         // 3
    | "twin"           // 2
    | "single";        // 1
  
  // === Meal Plans (mealplan) ===
  breakfast?: boolean;         // 1 - Breakfast included
  allInclusive?: boolean;      // 4
  selfCatering?: boolean;      // 999 - Kitchen amenities
  
  // === Stay Type & Policies ===
  petFriendly?: boolean;       // stay_type=1
  adultsOnly?: boolean;        // stay_type=2
  lgbtqFriendly?: boolean;     // stay_type=4 - Travel Proud
  
  // === Cancellation & Payment (fc) ===
  freeCancellation?: boolean;  // 2
  noPrepayment?: boolean;      // 5
  noBookingFee?: boolean;      // 4 - Book without credit card
  
  // === Sustainability ===
  sustainabilityCertified?: boolean; // SustainablePropertyLevelFilter=4
  
  // === Accessibility - Hotel (accessible_facilities) ===
  wheelchairAccessible?: boolean; // accessible_room_facilities=134
  groundFloor?: boolean;          // accessible_room_facilities=131
  elevatorAccess?: boolean;       // accessible_room_facilities=132
  grabRails?: boolean;            // accessible_facilities=186
  raisedToilet?: boolean;         // accessible_facilities=187
  loweredSink?: boolean;          // accessible_facilities=188
  emergencyCord?: boolean;        // accessible_facilities=189
  braille?: boolean;              // accessible_facilities=211
  tactileSigns?: boolean;         // accessible_facilities=212
  auditoryGuidance?: boolean;     // accessible_facilities=213
  walkInShower?: boolean;         // accessible_room_facilities=150
  rollInShower?: boolean;         // accessible_room_facilities=149
  showerChair?: boolean;          // accessible_room_facilities=154
  
  // === Distance from center (distance in meters) ===
  maxDistanceFromCenter?: 
    | "half_mile"    // 805
    | "1_mile"       // 1610
    | "2_miles";     // 3220
    
  // === Popular Activities ===
  snorkeling?: boolean;        // popular_activities=90
  diving?: boolean;            // popular_activities=86
  fishing?: boolean;           // popular_activities=19
  hiking?: boolean;            // popular_activities=253
  cycling?: boolean;           // popular_activities=255
  skiing?: boolean;            // popular_activities=13
  waterSports?: boolean;       // popular_activities=410
  horseRiding?: boolean;       // popular_activities=407
  
  // === Hotel Chains (chaincode) ===
  hotelChain?: 
    | "marriott"       // 1080
    | "hilton"         // 1078
    | "hyatt"          // 3632 (Hyatt Place)
    | "ihg"            // 1072 (Holiday Inn)
    | "wyndham"        // 1048
    | "best_western"   // 1035
    | "accor"          // 1025
    | "choice"         // 1040
    | "radisson"       // 1084
    | "ritz_carlton"   // 1094
    | "four_seasons"   // 1061
    | "fairmont"       // 1060
    | "sheraton"       // 1085
    | "westin"         // 1096
    | "w_hotels"       // 1097
    | "courtyard"      // 1093
    | "residence_inn"  // 1098
    | "hampton"        // 1075
    | "embassy_suites" // 1983
    | "doubletree";    // 1044
}

export interface HotelResult {
  name: string;
  price: number | null;
  priceDisplay: string;
  rating: number | null;
  ratingText: string;
  reviewCount: number | null;
  location: string;
  distanceToCenter: string;
  amenities: string[];
  highlights: string[];
  link: string;
  thumbnailUrl: string | null;
  availability: string | null; // e.g., "Only 2 rooms left", "Last booked 5 minutes ago"
  matchScore?: number;
  matchReasons?: string[];
}

// Detailed hotel info for comparison
export interface HotelDetails {
  name: string;
  url: string;
  rating: number | null;
  ratingText: string;
  reviewCount: number | null;
  starRating: number | null;
  address: string;
  description: string;
  highlights: string;
  pricePerNight: number | null;
  priceDisplay: string;
  totalPrice: string;
  checkInTime: string;
  checkOutTime: string;
  popularFacilities: string[];
  allFacilities: string[];
  roomTypes: string[];
  photos: string[];
  nearbyAttractions: string[];
  guestReviewHighlights: string[];
  locationInfo: string;
}

// Room amenity category (from GraphQL room facilities API)
export interface RoomAmenityCategory {
  category: string;
  items: string[];
}

// Room option from availability check
export interface RoomOption {
  name: string;
  price: number | null;
  priceDisplay: string;
  sleeps: number | null;
  features: string[];
  bedType: string;
  cancellation: string;
  breakfast: string;
  roomTypeId?: string;  // Room type ID for mapping facilities
  amenities?: RoomAmenityCategory[];  // Room-specific amenities (AC, TV, bathroom, etc.)
}

// Availability check result
export interface AvailabilityResult {
  available: boolean;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  roomOptions: RoomOption[];
  lowestPrice: number | null;
  lowestPriceDisplay: string;
  message: string;
  url: string;
}

// Filters for searching specific hotel rates via API
export interface HotelRateFilters {
  breakfast?: boolean;        // Include breakfast (mealplan=1)
  freeCancellation?: boolean; // Free cancellation only (fc=2)
  bedType?: "king" | "queen" | "double" | "twin" | "single";
}

// Rate result from API-based hotel rate search
export interface HotelRateResult {
  hotelName: string;
  hotelId: string;
  hotelUrl: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  // Rate details from blocks array
  roomName: string;
  roomId: string;
  price: number;
  priceDisplay: string;
  pricePerNight: number;
  currency: string;
  mealPlan: string;           // "Room only", "Breakfast included", etc.
  cancellationPolicy: string; // "Free cancellation until X" or "Non-refundable"
  freeCancellationUntil: string | null;
  // Bed info from matchingUnitConfigurations
  bedType: string;
  bedCount: number;
}

// Individual review from guest
export interface Review {
  title: string;
  rating: number | null;
  date: string;
  travelerType: string;
  country: string;
  stayDate: string;
  roomType: string;
  nightsStayed: string;
  positive: string;
  negative: string;
}

// Rating breakdown by category
export interface RatingBreakdown {
  staff: number | null;
  facilities: number | null;
  cleanliness: number | null;
  comfort: number | null;
  valueForMoney: number | null;
  location: number | null;
  freeWifi: number | null;
}

// Reviews result
export interface ReviewsResult {
  hotelName: string;
  overallRating: number | null;
  totalReviews: number;
  ratingBreakdown: RatingBreakdown;
  reviews: Review[];
  url: string;
}

// Price for a specific date
export interface DatePrice {
  date: string;           // YYYY-MM-DD
  price: number | null;   // Lowest price for that night
  priceDisplay: string;   // Formatted price (e.g., "$241")
  available: boolean;     // Whether rooms are available
  currency: string;       // Currency code
}

// Price calendar result
export interface PriceCalendarResult {
  hotelName: string;
  startDate: string;
  endDate: string;
  nights: number;
  currency: string;
  prices: DatePrice[];
  lowestPrice: number | null;
  lowestPriceDate: string | null;
  highestPrice: number | null;
  highestPriceDate: string | null;
  averagePrice: number | null;
  url: string;
}

// Booking.com filter code mappings
const FILTER_CODES = {
  // Property Types
  propertyType: {
    hotel: "ht_id=204",
    apartment: "ht_id=201",
    resort: "ht_id=206",
    villa: "ht_id=213",
    vacation_home: "ht_id=220",
    hostel: "ht_id=203",
    bnb: "ht_id=208",
    guesthouse: "ht_id=216",
    homestay: "ht_id=222",
    motel: "ht_id=205",
    inn: "ht_id=207",
    lodge: "ht_id=221",
    chalet: "ht_id=228",
    campground: "ht_id=214",
    glamping: "ht_id=224",
    boat: "ht_id=215",
    capsule: "ht_id=225",
    ryokan: "ht_id=218",
    riad: "ht_id=226",
    country_house: "ht_id=223",
    farm_stay: "ht_id=210",
  },
  
  // Star ratings
  starRating: {
    1: "class=1",
    2: "class=2",
    3: "class=3",
    4: "class=4",
    5: "class=5",
  },
  
  // Hotel facilities
  hotelfacility: {
    freeWifi: 107,
    pool: 433,
    spa: 54,
    parking: 2,
    restaurant: 3,
    bar: 8,
    roomService: 5,
    airportShuttle: 17,
    hotTub: 63,
    sauna: 79,
    garden: 104,
    terrace: 6,
    nonSmokingRooms: 16,
    familyRooms: 28,
    disabledFacilities: 25,
    evCharging: 182,
    tennis: 90,
    casino: 78,
    bbqFacilities: 106,
    laundry: 52,
    concierge: 118,
    currencyExchange: 91,
    businessCenter: 10,
    meetingRooms: 126,
  },
  
  // Room facilities
  roomfacility: {
    airConditioning: 11,
    kitchen: 999,
    balcony: 17,
    privatePool: 93,
    privateBathroom: 38,
    bath: 67,
    tv: 75,
    minibar: 6,
    safe: 14,
    washingMachine: 98,
    soundproofing: 133,
    oceanView: 108,
  },
  
  // Bed types
  bedType: {
    king: "tdb=6",
    queen: "tdb=5",
    double: "tdb=3",
    twin: "tdb=2",
    single: "tdb=1",
  },
  
  // Meal plans
  mealplan: {
    breakfast: 1,
    allInclusive: 4,
    selfCatering: 999,
  },
  
  // Stay type
  stayType: {
    petFriendly: 1,
    adultsOnly: 2,
    lgbtqFriendly: 4,
  },
  
  // Cancellation
  fc: {
    freeCancellation: 2,
    noPrepayment: 5,
    noBookingFee: 4,
  },
  
  // Distance from center (in meters)
  distance: {
    half_mile: 805,
    "1_mile": 1610,
    "2_miles": 3220,
  },
  
  // Popular activities
  popularActivities: {
    fitness: 11,
    beach: 302,
    golf: 12,
    snorkeling: 90,
    diving: 86,
    fishing: 19,
    hiking: 253,
    cycling: 255,
    skiing: 13,
    waterSports: 410,
    horseRiding: 407,
  },
  
  // Accessibility - hotel level
  accessibleFacilities: {
    grabRails: 186,
    raisedToilet: 187,
    loweredSink: 188,
    emergencyCord: 189,
    braille: 211,
    tactileSigns: 212,
    auditoryGuidance: 213,
  },
  
  // Accessibility - room level
  accessibleRoomFacilities: {
    wheelchairAccessible: 134,
    groundFloor: 131,
    elevatorAccess: 132,
    walkInShower: 150,
    rollInShower: 149,
    showerChair: 154,
    adaptedBath: 148,
    roomGrabRails: 147,
    roomLoweredSink: 152,
    roomRaisedToilet: 151,
    roomEmergencyCord: 153,
  },
  
  // Hotel chains
  chaincode: {
    marriott: 1080,
    hilton: 1078,
    hyatt: 3632,
    ihg: 1072,
    wyndham: 1048,
    best_western: 1035,
    accor: 1025,
    choice: 1040,
    radisson: 1084,
    ritz_carlton: 1094,
    four_seasons: 1061,
    fairmont: 1060,
    sheraton: 1085,
    westin: 1096,
    w_hotels: 1097,
    courtyard: 1093,
    residence_inn: 1098,
    hampton: 1075,
    embassy_suites: 1983,
    doubletree: 1044,
  },
};

export class HotelBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private lastRequestTime: number = 0;
  private minRequestIntervalMs: number = 2000; // Minimum 2 seconds between requests
  private proxyConfig: ProxyConfig | null = null;
  private currentUserAgent: string = "";
  private sessionPath: string = "";

  async init(headless: boolean = true, proxy?: ProxyConfig): Promise<void> {
    // Store proxy config for reference
    this.proxyConfig = proxy || null;
    
    // Select a random user agent for this session
    this.currentUserAgent = getRandomUserAgent();
    
    // Determine session path
    this.sessionPath = getSessionPath();
    const hasExistingSession = this.sessionPath && fs.existsSync(this.sessionPath);
    
    logger.debug({ 
      headless, 
      hasProxy: !!proxy, 
      userAgent: this.currentUserAgent,
      sessionPath: this.sessionPath || "(disabled)",
      hasExistingSession
    }, "Initializing browser");
    
    // Build launch options
    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless,
      args: ["--disable-blink-features=AutomationControlled"],
    };
    
    // Add proxy to launch options if provided
    if (proxy) {
      launchOptions.proxy = {
        server: proxy.server,
        username: proxy.username,
        password: proxy.password,
      };
    }
    
    this.browser = await chromium.launch(launchOptions);
    
    // Build context options
    const contextOptions: Parameters<typeof this.browser.newContext>[0] = {
      userAgent: this.currentUserAgent,
      viewport: { width: 1280, height: 900 },
    };
    
    // Load existing session state if available
    if (hasExistingSession) {
      try {
        contextOptions.storageState = this.sessionPath;
        logger.debug({ sessionPath: this.sessionPath }, "Loading existing session");
      } catch (error) {
        logger.warn({ error, sessionPath: this.sessionPath }, "Failed to load session, starting fresh");
      }
    }
    
    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();
    
    logger.info({ 
      hasProxy: !!proxy, 
      sessionLoaded: hasExistingSession 
    }, "Browser initialized successfully");
  }

  /**
   * Save the current session (cookies, localStorage) to disk
   * Call this after successful requests to persist session state
   */
  async saveSession(): Promise<boolean> {
    if (!this.context || !this.sessionPath) {
      logger.debug("Cannot save session: no context or session path disabled");
      return false;
    }
    
    try {
      // Ensure directory exists
      const sessionDir = path.dirname(this.sessionPath);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
        logger.debug({ sessionDir }, "Created session directory");
      }
      
      // Save storage state (cookies + localStorage)
      await this.context.storageState({ path: this.sessionPath });
      logger.debug({ sessionPath: this.sessionPath }, "Session saved successfully");
      return true;
    } catch (error) {
      logger.warn({ error, sessionPath: this.sessionPath }, "Failed to save session");
      return false;
    }
  }

  /**
   * Check if session persistence is enabled
   */
  hasSessionPath(): boolean {
    return !!this.sessionPath;
  }

  /**
   * Get the current session file path
   */
  getSessionPath(): string | null {
    return this.sessionPath || null;
  }

  /**
   * Check if a saved session file exists
   */
  static hasExistingSession(): boolean {
    const sessionPath = getSessionPath();
    return !!sessionPath && fs.existsSync(sessionPath);
  }

  /**
   * Clear the saved session file
   */
  static clearSession(): boolean {
    const sessionPath = getSessionPath();
    if (sessionPath && fs.existsSync(sessionPath)) {
      try {
        fs.unlinkSync(sessionPath);
        logger.info({ sessionPath }, "Session cleared");
        return true;
      } catch (error) {
        logger.warn({ error, sessionPath }, "Failed to clear session");
        return false;
      }
    }
    return false;
  }

  /**
   * Check if a proxy is configured
   */
  hasProxy(): boolean {
    return this.proxyConfig !== null;
  }

  /**
   * Get the current proxy server (without credentials)
   */
  getProxyServer(): string | null {
    return this.proxyConfig?.server || null;
  }

  /**
   * Get the current user agent being used
   */
  getUserAgent(): string {
    return this.currentUserAgent;
  }

  /**
   * Get the list of available user agents
   */
  static getAvailableUserAgents(): string[] {
    return [...USER_AGENTS];
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      logger.debug("Browser closed");
    }
  }

  private buildBookingUrl(params: HotelSearchParams, filters?: HotelFilters): string {
    const { destination, checkIn, checkOut, guests, rooms, currency, sortBy } = params;
    
    const url = new URL("https://www.booking.com/searchresults.html");
    url.searchParams.set("ss", destination);
    url.searchParams.set("checkin", checkIn);
    url.searchParams.set("checkout", checkOut);
    url.searchParams.set("group_adults", guests.toString());
    url.searchParams.set("no_rooms", rooms.toString());
    url.searchParams.set("selected_currency", currency || "USD");
    
    // Sort order
    if (sortBy) {
      const sortMap: Record<string, string> = {
        popularity: "popularity",
        price_lowest: "price",
        price_highest: "price",
        rating: "review_score_and_price",
        distance: "distance_from_search",
      };
      url.searchParams.set("order", sortMap[sortBy] || "popularity");
      if (sortBy === "price_highest") {
        url.searchParams.set("sort_order", "desc");
      }
    }
    
    if (!filters) return url.toString();
    
    const nfltParts: string[] = [];
    
    // === Rating ===
    if (filters.minRating) {
      const scoreFilter = Math.floor(filters.minRating) * 10;
      nfltParts.push(`review_score=${scoreFilter}`);
    }
    
    // === Property Type ===
    if (filters.propertyType) {
      const code = FILTER_CODES.propertyType[filters.propertyType];
      if (code) nfltParts.push(code);
    }
    
    // === Star Rating ===
    if (filters.starRating) {
      const code = FILTER_CODES.starRating[filters.starRating];
      if (code) nfltParts.push(code);
    }
    
    // === Beach & Location ===
    if (filters.beachfront) nfltParts.push("ht_beach=1");
    if (filters.beachAccess) nfltParts.push("popular_activities=302");
    
    // === Hotel Facilities ===
    const hotelFacilities = FILTER_CODES.hotelfacility;
    if (filters.freeWifi) nfltParts.push(`hotelfacility=${hotelFacilities.freeWifi}`);
    if (filters.pool) nfltParts.push(`hotelfacility=${hotelFacilities.pool}`);
    if (filters.spa) nfltParts.push(`hotelfacility=${hotelFacilities.spa}`);
    if (filters.parking || filters.freeParking) nfltParts.push(`hotelfacility=${hotelFacilities.parking}`);
    if (filters.restaurant) nfltParts.push(`hotelfacility=${hotelFacilities.restaurant}`);
    if (filters.bar) nfltParts.push(`hotelfacility=${hotelFacilities.bar}`);
    if (filters.roomService) nfltParts.push(`hotelfacility=${hotelFacilities.roomService}`);
    if (filters.airportShuttle) nfltParts.push(`hotelfacility=${hotelFacilities.airportShuttle}`);
    if (filters.hotTub) nfltParts.push(`hotelfacility=${hotelFacilities.hotTub}`);
    if (filters.sauna) nfltParts.push(`hotelfacility=${hotelFacilities.sauna}`);
    if (filters.garden) nfltParts.push(`hotelfacility=${hotelFacilities.garden}`);
    if (filters.terrace) nfltParts.push(`hotelfacility=${hotelFacilities.terrace}`);
    if (filters.nonSmokingRooms) nfltParts.push(`hotelfacility=${hotelFacilities.nonSmokingRooms}`);
    if (filters.familyRooms) nfltParts.push(`hotelfacility=${hotelFacilities.familyRooms}`);
    if (filters.disabledFacilities) nfltParts.push(`hotelfacility=${hotelFacilities.disabledFacilities}`);
    if (filters.evCharging) nfltParts.push(`hotelfacility=${hotelFacilities.evCharging}`);
    if (filters.tennis) nfltParts.push(`hotelfacility=${hotelFacilities.tennis}`);
    if (filters.casino) nfltParts.push(`hotelfacility=${hotelFacilities.casino}`);
    if (filters.bbqFacilities) nfltParts.push(`hotelfacility=${hotelFacilities.bbqFacilities}`);
    if (filters.laundry) nfltParts.push(`hotelfacility=${hotelFacilities.laundry}`);
    if (filters.concierge) nfltParts.push(`hotelfacility=${hotelFacilities.concierge}`);
    if (filters.currencyExchange) nfltParts.push(`hotelfacility=${hotelFacilities.currencyExchange}`);
    if (filters.businessCenter) nfltParts.push(`hotelfacility=${hotelFacilities.businessCenter}`);
    if (filters.meetingRooms) nfltParts.push(`hotelfacility=${hotelFacilities.meetingRooms}`);
    
    // === Room Facilities ===
    const roomFacilities = FILTER_CODES.roomfacility;
    if (filters.airConditioning) nfltParts.push(`roomfacility=${roomFacilities.airConditioning}`);
    if (filters.kitchen) nfltParts.push(`roomfacility=${roomFacilities.kitchen}`);
    if (filters.balcony) nfltParts.push(`roomfacility=${roomFacilities.balcony}`);
    if (filters.privatePool) nfltParts.push(`roomfacility=${roomFacilities.privatePool}`);
    if (filters.privateBathroom) nfltParts.push(`roomfacility=${roomFacilities.privateBathroom}`);
    if (filters.bath) nfltParts.push(`roomfacility=${roomFacilities.bath}`);
    if (filters.tv) nfltParts.push(`roomfacility=${roomFacilities.tv}`);
    if (filters.minibar) nfltParts.push(`roomfacility=${roomFacilities.minibar}`);
    if (filters.safe) nfltParts.push(`roomfacility=${roomFacilities.safe}`);
    if (filters.washingMachine) nfltParts.push(`roomfacility=${roomFacilities.washingMachine}`);
    if (filters.soundproofing) nfltParts.push(`roomfacility=${roomFacilities.soundproofing}`);
    if (filters.oceanView) nfltParts.push(`roomfacility=${roomFacilities.oceanView}`);
    
    // === Bed Type ===
    if (filters.bedType) {
      const code = FILTER_CODES.bedType[filters.bedType];
      if (code) nfltParts.push(code);
    }
    
    // === Meal Plans ===
    if (filters.breakfast) nfltParts.push(`mealplan=${FILTER_CODES.mealplan.breakfast}`);
    if (filters.allInclusive) nfltParts.push(`mealplan=${FILTER_CODES.mealplan.allInclusive}`);
    if (filters.selfCatering) nfltParts.push(`mealplan=${FILTER_CODES.mealplan.selfCatering}`);
    
    // === Stay Type ===
    if (filters.petFriendly) nfltParts.push(`stay_type=${FILTER_CODES.stayType.petFriendly}`);
    if (filters.adultsOnly) nfltParts.push(`stay_type=${FILTER_CODES.stayType.adultsOnly}`);
    if (filters.lgbtqFriendly) nfltParts.push(`stay_type=${FILTER_CODES.stayType.lgbtqFriendly}`);
    
    // === Cancellation & Payment ===
    if (filters.freeCancellation) nfltParts.push(`fc=${FILTER_CODES.fc.freeCancellation}`);
    if (filters.noPrepayment) nfltParts.push(`fc=${FILTER_CODES.fc.noPrepayment}`);
    if (filters.noBookingFee) nfltParts.push(`fc=${FILTER_CODES.fc.noBookingFee}`);
    
    // === Sustainability ===
    if (filters.sustainabilityCertified) nfltParts.push("SustainablePropertyLevelFilter=4");
    
    // === Distance from center ===
    if (filters.maxDistanceFromCenter) {
      const distance = FILTER_CODES.distance[filters.maxDistanceFromCenter];
      if (distance) nfltParts.push(`distance=${distance}`);
    }
    
    // === Popular Activities ===
    const activities = FILTER_CODES.popularActivities;
    if (filters.fitness) nfltParts.push(`popular_activities=${activities.fitness}`);
    if (filters.golf) nfltParts.push(`popular_activities=${activities.golf}`);
    if (filters.snorkeling) nfltParts.push(`popular_activities=${activities.snorkeling}`);
    if (filters.diving) nfltParts.push(`popular_activities=${activities.diving}`);
    if (filters.fishing) nfltParts.push(`popular_activities=${activities.fishing}`);
    if (filters.hiking) nfltParts.push(`popular_activities=${activities.hiking}`);
    if (filters.cycling) nfltParts.push(`popular_activities=${activities.cycling}`);
    if (filters.skiing) nfltParts.push(`popular_activities=${activities.skiing}`);
    if (filters.waterSports) nfltParts.push(`popular_activities=${activities.waterSports}`);
    if (filters.horseRiding) nfltParts.push(`popular_activities=${activities.horseRiding}`);
    
    // === Accessibility - Hotel ===
    const accessFac = FILTER_CODES.accessibleFacilities;
    if (filters.grabRails) nfltParts.push(`accessible_facilities=${accessFac.grabRails}`);
    if (filters.raisedToilet) nfltParts.push(`accessible_facilities=${accessFac.raisedToilet}`);
    if (filters.loweredSink) nfltParts.push(`accessible_facilities=${accessFac.loweredSink}`);
    if (filters.emergencyCord) nfltParts.push(`accessible_facilities=${accessFac.emergencyCord}`);
    if (filters.braille) nfltParts.push(`accessible_facilities=${accessFac.braille}`);
    if (filters.tactileSigns) nfltParts.push(`accessible_facilities=${accessFac.tactileSigns}`);
    if (filters.auditoryGuidance) nfltParts.push(`accessible_facilities=${accessFac.auditoryGuidance}`);
    
    // === Accessibility - Room ===
    const accessRoom = FILTER_CODES.accessibleRoomFacilities;
    if (filters.wheelchairAccessible) nfltParts.push(`accessible_room_facilities=${accessRoom.wheelchairAccessible}`);
    if (filters.groundFloor) nfltParts.push(`accessible_room_facilities=${accessRoom.groundFloor}`);
    if (filters.elevatorAccess) nfltParts.push(`accessible_room_facilities=${accessRoom.elevatorAccess}`);
    if (filters.walkInShower) nfltParts.push(`accessible_room_facilities=${accessRoom.walkInShower}`);
    if (filters.rollInShower) nfltParts.push(`accessible_room_facilities=${accessRoom.rollInShower}`);
    if (filters.showerChair) nfltParts.push(`accessible_room_facilities=${accessRoom.showerChair}`);
    
    // === Hotel Chain ===
    if (filters.hotelChain) {
      const chainCode = FILTER_CODES.chaincode[filters.hotelChain];
      if (chainCode) nfltParts.push(`chaincode=${chainCode}`);
    }
    
    if (nfltParts.length > 0) {
      url.searchParams.set("nflt", nfltParts.join(";"));
    }
    
    return url.toString();
  }

  // Rate limiting: ensure minimum time between requests
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestIntervalMs) {
      const waitTime = this.minRequestIntervalMs - timeSinceLastRequest;
      await sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  // Check for CAPTCHA or blocking pages
  private async checkForBlocking(): Promise<void> {
    if (!this.page) return;

    const pageContent = await this.page.content();
    const pageUrl = this.page.url();

    // Check for CAPTCHA
    const captchaIndicators = [
      "captcha",
      "recaptcha",
      "hcaptcha",
      "challenge-running",
      "challenge-form",
      "px-captcha",
    ];
    
    const hasCaptcha = captchaIndicators.some(
      indicator => pageContent.toLowerCase().includes(indicator)
    );
    
    if (hasCaptcha) {
      throw new HotelSearchError(
        "CAPTCHA detected. Please wait a few minutes before retrying.",
        ErrorCodes.CAPTCHA_DETECTED,
        false // Not retryable automatically
      );
    }

    // Check for rate limiting / blocking
    const blockIndicators = [
      "access denied",
      "too many requests",
      "rate limit",
      "blocked",
      "forbidden",
      "error 403",
      "error 429",
    ];
    
    const isBlocked = blockIndicators.some(
      indicator => pageContent.toLowerCase().includes(indicator)
    );
    
    if (isBlocked || pageUrl.includes("blocked") || pageUrl.includes("error")) {
      throw new HotelSearchError(
        "Request blocked by Booking.com. Please wait a few minutes before retrying.",
        ErrorCodes.BLOCKED,
        true // Retryable with backoff
      );
    }
  }

  // Check if destination was found
  private async checkForNoResults(): Promise<void> {
    if (!this.page) return;

    const pageContent = await this.page.content();
    
    // Check for "no results" or "destination not found" messages
    const noResultsIndicators = [
      "no properties found",
      "no results",
      "0 properties",
      "we couldn't find",
      "try different dates",
    ];
    
    const hasNoResults = noResultsIndicators.some(
      indicator => pageContent.toLowerCase().includes(indicator)
    );
    
    if (hasNoResults) {
      // Check if it's a destination issue or just no matching filters
      const destinationIssue = pageContent.toLowerCase().includes("destination") && 
        (pageContent.toLowerCase().includes("not found") || 
         pageContent.toLowerCase().includes("couldn't find"));
      
      if (destinationIssue) {
        throw new HotelSearchError(
          "Destination not found. Please check the spelling and try again.",
          ErrorCodes.DESTINATION_NOT_FOUND,
          false
        );
      }
      
      // No results but destination is valid - this is not an error, just empty results
    }
  }

  async searchHotels(
    params: HotelSearchParams,
    filters?: HotelFilters
  ): Promise<HotelResult[]> {
    if (!this.page) {
      throw new HotelSearchError(
        "Browser not initialized. Call init() first.",
        ErrorCodes.BROWSER_NOT_INITIALIZED,
        false
      );
    }

    const url = this.buildBookingUrl(params, filters);
    
    logger.info(
      { destination: params.destination, checkIn: params.checkIn, checkOut: params.checkOut, hasFilters: !!filters },
      "Starting hotel search"
    );
    logger.debug({ url }, "Search URL");
    
    // Use retry with exponential backoff for the main search operation
    return await retryWithBackoff(
      async () => {
        // Enforce rate limiting
        await this.enforceRateLimit();
        
        try {
          await this.page!.goto(url, { 
            waitUntil: "networkidle",
            timeout: 30000 
          });
        } catch (error) {
          const err = error as Error;
          if (err.message.includes("timeout") || err.message.includes("Timeout")) {
            throw new HotelSearchError(
              "Page load timed out. The server may be slow or unavailable.",
              ErrorCodes.TIMEOUT,
              true
            );
          }
          if (err.message.includes("net::") || err.message.includes("Network")) {
            throw new HotelSearchError(
              "Network error occurred. Please check your connection.",
              ErrorCodes.NETWORK_ERROR,
              true
            );
          }
          throw new HotelSearchError(
            `Navigation failed: ${err.message}`,
            ErrorCodes.NAVIGATION_FAILED,
            true
          );
        }
        
        await this.page!.waitForTimeout(2000);

        // Check for blocking/CAPTCHA before proceeding
        await this.checkForBlocking();
        
        // Check for no results / destination issues
        await this.checkForNoResults();

        // Close any popups/modals
        await this.dismissPopups();

        // Scroll to load more results (pass limit to control how many to load)
        const targetResults = params.limit || 25;
        await this.scrollToLoadMore(targetResults);

        // Try API-based extraction first (more reliable), fall back to DOM scraping
        let hotels = await this.extractHotelsFromAPI();
        
        if (hotels.length === 0) {
          logger.debug("API extraction returned no results, falling back to DOM scraping");
          hotels = await this.extractHotelDetails();
        } else {
          logger.debug({ hotelCount: hotels.length }, "Hotels extracted from API cache");
        }
        
        logger.debug({ hotelCount: hotels.length }, "Hotels extracted from page");
        
        // Apply limit to cap results
        if (params.limit && params.limit > 0) {
          hotels = hotels.slice(0, params.limit);
        }

        // Apply client-side filtering and scoring if we have preferences
        if (filters) {
          const scored = this.scoreAndFilterHotels(hotels, filters);
          logger.info({ resultCount: scored.length }, "Search completed with filters");
          // Auto-save session after successful search
          await this.saveSession();
          return scored;
        }

        logger.info({ resultCount: hotels.length }, "Search completed");
        // Auto-save session after successful search
        await this.saveSession();
        return hotels;
      },
      DEFAULT_RETRY_CONFIG,
      (attempt, error, delayMs) => {
        logger.warn(
          { attempt, error: error.message, retryInMs: delayMs },
          "Search attempt failed, retrying"
        );
      }
    );
  }

  /**
   * Search for a specific hotel's rate via the search API.
   * This is 100% API-based (no HTML scraping) and returns detailed rate info
   * including room type, meal plan, cancellation policy, and bed configuration.
   * 
   * The method searches for the hotel by name and extracts rate details from
   * the Apollo cache's `blocks` array and `matchingUnitConfigurations`.
   * 
   * @param hotelUrl - The hotel's URL or name/slug (e.g., "la-sanguine" or full URL)
   * @param checkIn - Check-in date (YYYY-MM-DD)
   * @param checkOut - Check-out date (YYYY-MM-DD)
   * @param guests - Number of guests
   * @param rooms - Number of rooms
   * @param filters - Optional rate filters (breakfast, free cancellation, bed type)
   * @returns Rate details or null if hotel not found in results
   */
  async searchHotelRates(
    hotelUrl: string,
    checkIn: string,
    checkOut: string,
    guests: number = 2,
    rooms: number = 1,
    filters?: HotelRateFilters
  ): Promise<HotelRateResult | null> {
    if (!this.page) {
      throw new HotelSearchError(
        "Browser not initialized. Call init() first.",
        ErrorCodes.BROWSER_NOT_INITIALIZED,
        false
      );
    }

    // Extract hotel name from URL for search query
    const hotelName = this.extractHotelNameFromUrl(hotelUrl);
    if (!hotelName) {
      throw new HotelSearchError(
        "Could not extract hotel name from URL",
        ErrorCodes.INVALID_PARAMS,
        false
      );
    }

    logger.info(
      { hotelName, checkIn, checkOut, guests, rooms, hasFilters: !!filters },
      "Searching for hotel rate via API"
    );

    // Build search URL with hotel name as destination
    const searchFilters: HotelFilters = {};
    
    // Apply rate-specific filters
    if (filters?.breakfast) {
      searchFilters.breakfast = true;
    }
    if (filters?.freeCancellation) {
      searchFilters.freeCancellation = true;
    }

    const searchParams: HotelSearchParams = {
      destination: hotelName.replace(/-/g, " "), // "la-sanguine" -> "la sanguine"
      checkIn,
      checkOut,
      guests,
      rooms,
      limit: 10, // Small limit since we're looking for a specific hotel
    };

    const url = this.buildBookingUrl(searchParams, searchFilters);
    logger.debug({ url }, "Hotel rate search URL");

    return await retryWithBackoff(
      async () => {
        await this.enforceRateLimit();

        try {
          await this.page!.goto(url, {
            waitUntil: "networkidle",
            timeout: 30000,
          });
        } catch (error) {
          const err = error as Error;
          if (err.message.includes("timeout") || err.message.includes("Timeout")) {
            throw new HotelSearchError(
              "Page load timed out. The server may be slow or unavailable.",
              ErrorCodes.TIMEOUT,
              true
            );
          }
          throw new HotelSearchError(
            `Navigation failed: ${err.message}`,
            ErrorCodes.NAVIGATION_FAILED,
            true
          );
        }

        await this.page!.waitForTimeout(2000);
        await this.checkForBlocking();
        await this.dismissPopups();

        // Extract rate details from Apollo cache
        const rateResult = await this.extractHotelRateFromAPI(hotelName, filters);

        if (rateResult) {
          // Populate search params in result
          rateResult.checkIn = checkIn;
          rateResult.checkOut = checkOut;
          rateResult.guests = guests;
          rateResult.rooms = rooms;
          
          logger.info(
            { hotelName: rateResult.hotelName, price: rateResult.price, roomName: rateResult.roomName },
            "Hotel rate found via API"
          );
          await this.saveSession();
          return rateResult;
        }

        logger.warn({ hotelName }, "Hotel not found in search results");
        return null;
      },
      DEFAULT_RETRY_CONFIG,
      (attempt, error, delayMs) => {
        logger.warn(
          { attempt, error: error.message, retryInMs: delayMs },
          "Hotel rate search failed, retrying"
        );
      }
    );
  }

  /**
   * Extract hotel name/slug from a Booking.com URL.
   * Handles formats like:
   * - https://www.booking.com/hotel/fr/la-sanguine.html
   * - /hotel/fr/la-sanguine.html
   * - la-sanguine
   */
  private extractHotelNameFromUrl(urlOrName: string): string | null {
    // If it's just a name/slug (no slashes), return as-is
    if (!urlOrName.includes("/")) {
      return urlOrName.replace(/\.html$/, "");
    }

    // Extract from URL pattern: /hotel/{country}/{name}.html
    const match = urlOrName.match(/\/hotel\/[a-z]{2}\/([^/.]+)/i);
    if (match && match[1]) {
      return match[1];
    }

    // Fallback: try to get the last path segment
    const parts = urlOrName.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1];
    return lastPart?.replace(/\.html$/, "") || null;
  }

  /**
   * Extract hotel rate details from Apollo cache.
   * Finds the hotel matching the given name and extracts rate info from
   * the `blocks` array and `matchingUnitConfigurations`.
   */
  private async extractHotelRateFromAPI(
    hotelSlug: string,
    filters?: HotelRateFilters
  ): Promise<HotelRateResult | null> {
    if (!this.page) return null;

    // Bed type mapping for filter matching
    const bedTypeMap: Record<string, number> = {
      single: 1,
      twin: 2,
      double: 3,
      queen: 5,
      king: 6,
    };
    const targetBedType = filters?.bedType ? bedTypeMap[filters.bedType] : undefined;

    return await this.page.evaluate(
      ({ hotelSlug, targetBedType }) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = window as any;
          const cache = w.__caplaDataStore?.apollo?.cache?.data?.data;
          if (!cache) return null;

          const rootQuery = cache["ROOT_QUERY"];
          if (!rootQuery) return null;

          const searchQueries = rootQuery.searchQueries;
          if (!searchQueries) return null;

          const searchKey = Object.keys(searchQueries).find((k) =>
            k.startsWith("search(")
          );
          if (!searchKey) return null;

          const searchOutput = searchQueries[searchKey];
          const searchResults = searchOutput?.results;
          if (!searchResults || !Array.isArray(searchResults)) return null;

          // Find hotel matching the slug (check pageName)
          const normalizedSlug = hotelSlug.toLowerCase().replace(/-/g, "");
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hotel = searchResults.find((h: any) => {
            if (!h) return false;
            const pageName = h.basicPropertyData?.pageName?.toLowerCase()?.replace(/-/g, "") || "";
            const displayName = h.displayName?.text?.toLowerCase()?.replace(/\s+/g, "") || "";
            return pageName.includes(normalizedSlug) || 
                   normalizedSlug.includes(pageName) ||
                   displayName.includes(normalizedSlug) ||
                   normalizedSlug.includes(displayName);
          });

          if (!hotel) return null;

          // Extract basic hotel info
          const hotelName = hotel.displayName?.text || hotel.basicPropertyData?.pageName || "Unknown";
          const pageName = hotel.basicPropertyData?.pageName || "";
          const countryCode = hotel.basicPropertyData?.location?.countryCode || "";
          const hotelId = hotel.basicPropertyData?.id?.toString() || "";
          const hotelUrl = countryCode && pageName
            ? `https://www.booking.com/hotel/${countryCode}/${pageName}.html`
            : "";

          // Get price info
          const priceInfo = hotel.priceDisplayInfoIrene;
          const displayPrice = priceInfo?.displayPrice?.amountPerStay;
          const price = displayPrice?.amountUnformatted ?? 0;
          const priceDisplay = displayPrice?.amountRounded || displayPrice?.amount || "$0";
          const currency = displayPrice?.currency || "USD";
          const pricePerNight = priceInfo?.averagePricePerNight?.amountUnformatted ?? 0;

          // Get blocks array (rate options)
          const blocks = hotel.blocks;
          if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
            // No blocks, return basic info without detailed rate
            return {
              hotelName,
              hotelId,
              hotelUrl,
              checkIn: "",
              checkOut: "",
              guests: 0,
              rooms: 0,
              roomName: "Unknown",
              roomId: "",
              price,
              priceDisplay,
              pricePerNight,
              currency,
              mealPlan: "Unknown",
              cancellationPolicy: "Unknown",
              freeCancellationUntil: null,
              bedType: "Unknown",
              bedCount: 0,
            };
          }

          // Get the first (cheapest/best match) block
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const block = blocks[0] as any;
          const blockId = block.blockId || {};
          const roomId = blockId.roomId?.toString() || "";
          const mealPlanId = blockId.mealPlanId;
          
          // Meal plan mapping
          const mealPlanNames: Record<number, string> = {
            0: "Room only",
            1: "Breakfast included",
            2: "Half board",
            3: "Full board",
            4: "All-inclusive",
          };
          const mealPlan = mealPlanNames[mealPlanId] || "Room only";

          // Cancellation policy
          const freeCancellationUntil = block.freeCancellationUntil || null;
          const cancellationPolicy = freeCancellationUntil
            ? `Free cancellation until ${freeCancellationUntil}`
            : "Non-refundable";

          // Get room name and bed configuration from matchingUnitConfigurations
          let roomName = "Standard Room";
          let bedType = "Unknown";
          let bedCount = 0;

          const unitConfigs = hotel.matchingUnitConfigurations?.unitConfigurations;
          if (unitConfigs && Array.isArray(unitConfigs)) {
            // If filtering by bed type, try to find matching config
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let matchingConfig = unitConfigs[0] as any;
            
            if (targetBedType !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const bedMatch = unitConfigs.find((config: any) => {
                const beds = config.bedConfigurations?.[0]?.beds || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return beds.some((bed: any) => bed.type === targetBedType);
              });
              if (bedMatch) {
                matchingConfig = bedMatch;
              }
            }

            if (matchingConfig) {
              roomName = matchingConfig.name || roomName;
              const beds = matchingConfig.bedConfigurations?.[0]?.beds;
              if (beds && beds.length > 0) {
                const firstBed = beds[0];
                bedCount = firstBed.count || 1;
                // Reverse map bed type
                const bedTypeNames: Record<number, string> = {
                  1: "Single",
                  2: "Twin",
                  3: "Double",
                  4: "Large Double",
                  5: "Queen",
                  6: "King",
                  7: "Super King",
                };
                bedType = bedTypeNames[firstBed.type] || "Unknown";
              }
            }
          }

          return {
            hotelName,
            hotelId,
            hotelUrl,
            checkIn: "", // Will be filled by caller
            checkOut: "",
            guests: 0,
            rooms: 0,
            roomName,
            roomId,
            price,
            priceDisplay,
            pricePerNight,
            currency,
            mealPlan,
            cancellationPolicy,
            freeCancellationUntil,
            bedType,
            bedCount,
          };
        } catch {
          return null;
        }
      },
      { hotelSlug, targetBedType }
    );
  }

  private async dismissPopups(): Promise<void> {
    if (!this.page) return;

    const popupSelectors = [
      '#onetrust-accept-btn-handler',
      '[data-testid="accept-btn"]',
      'button[aria-label="Dismiss sign-in info."]',
      '[aria-label="Dismiss sign in information."]',
      '.modal-mask button',
      '[data-testid="close-button"]',
    ];

    for (const selector of popupSelectors) {
      try {
        const btn = await this.page.$(selector);
        if (btn) {
          await btn.click();
          await this.page.waitForTimeout(500);
        }
      } catch {
        // Ignore popup dismissal errors
      }
    }
  }

  private async scrollToLoadMore(targetResults: number = 25): Promise<void> {
    if (!this.page) return;

    // If we only need 25 or fewer, minimal scrolling
    if (targetResults <= 25) {
      // Just one scroll to ensure initial results are loaded
      await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await this.page.waitForTimeout(1000);
      await this.page.evaluate(() => window.scrollTo(0, 0));
      return;
    }

    // For larger limits, we need to scroll and click "Load more" multiple times
    // Booking.com loads ~25 results initially, then ~25 more per "Load more" click
    const clicksNeeded = Math.ceil((targetResults - 25) / 25);
    const maxClicks = Math.min(clicksNeeded, 4); // Cap at 4 clicks (~125 results max)

    for (let i = 0; i < maxClicks; i++) {
      // Scroll to bottom to trigger lazy loading and find "Load more" button
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.page.waitForTimeout(1500);
      
      // Try to click "Load more" button
      try {
        const loadMoreBtn = await this.page.$('button[data-testid="load-more-results"]');
        if (loadMoreBtn) {
          await loadMoreBtn.click();
          await this.page.waitForTimeout(2000); // Wait for results to load
        } else {
          // No more "Load more" button, we've loaded all available results
          break;
        }
      } catch {
        // Button not found or click failed
        break;
      }
    }

    // Scroll back to top
    await this.page.evaluate(() => window.scrollTo(0, 0));
    await this.page.waitForTimeout(500);
  }

  private async extractHotelDetails(): Promise<HotelResult[]> {
    if (!this.page) return [];

    return await this.page.evaluate(() => {
      const results: HotelResult[] = [];
      const cards = document.querySelectorAll('[data-testid="property-card"]');

      cards.forEach((card) => {
        // Check if this is a paid/sponsored listing
        // Key indicator: "nad_" in the link means "native ad" - a PAID placement
        const cardHtml = card.outerHTML;
        const linkEl = card.querySelector('a[data-testid="title-link"]') as HTMLAnchorElement;
        const link = linkEl?.href || "";
        
        const isNativeAd = cardHtml.includes("nad_") || link.includes("nad_");
        
        // Also check for explicit "Ad" label text
        const hasAdLabel = Array.from(card.querySelectorAll('span, div')).some(el => {
          const text = el.textContent?.trim().toLowerCase();
          return text === "ad" || text === "sponsored" || text === "promoted";
        });
        
        // Skip sponsored/paid listings
        if (isNativeAd || hasAdLabel) {
          return; // Skip this card
        }

        // Name
        const nameEl = card.querySelector('[data-testid="title"]');
        const name = nameEl?.textContent?.trim() || "Unknown";

        // Price - look for per night price first, then total
        const allPriceEls = card.querySelectorAll('[data-testid="price-and-discounted-price"]');
        let priceText = "";
        let price: number | null = null;
        
        // First price element is usually per night
        const firstPriceEl = allPriceEls[0];
        if (firstPriceEl) {
          priceText = firstPriceEl.textContent?.trim() || "";
          const priceMatch = priceText.match(/\$?([\d,]+)/);
          price = priceMatch?.[1] ? parseInt(priceMatch[1].replace(",", "")) : null;
        }

        // Rating - look for the numeric score
        const ratingScoreEl = card.querySelector('[data-testid="review-score"] .dff2e52086');
        const ratingText = ratingScoreEl?.textContent?.trim() || "";
        const rating = ratingText ? parseFloat(ratingText) : null;

        // Rating description (e.g., "Excellent", "Very Good")
        const ratingDescEl = card.querySelector('[data-testid="review-score"] .f546354b44');
        const ratingDesc = ratingDescEl?.textContent?.trim() || "";

        // Review count
        const reviewCountEl = card.querySelector('[data-testid="review-score"] .fb14de7f14');
        const reviewText = reviewCountEl?.textContent || "";
        const reviewMatch = reviewText.match(/([\d,]+)/);
        const reviewCount = reviewMatch?.[1] ? parseInt(reviewMatch[1].replace(",", "")) : null;

        // Distance to center
        const distanceEl = card.querySelector('[data-testid="distance"]');
        const distanceToCenter = distanceEl?.textContent?.trim() || "";

        // Address/neighborhood
        const addressEl = card.querySelector('[data-testid="address-link"] span:first-child');
        const location = addressEl?.textContent?.trim() || "";

        // Collect all text for amenity detection
        const cardText = card.textContent?.toLowerCase() || "";
        const amenities: string[] = [];
        const highlights: string[] = [];

        // Extract beach info
        if (cardText.includes("beachfront")) {
          amenities.push("Beachfront");
        } else if (cardText.includes("beach nearby")) {
          amenities.push("Beach Nearby");
        } else if (cardText.includes("from beach")) {
          const beachMatch = cardText.match(/([\d.]+)\s*(miles?|feet|km|meters?)\s*from\s*beach/i);
          if (beachMatch) {
            amenities.push(`${beachMatch[1]} ${beachMatch[2]} from beach`);
          }
        }

        // Check for other amenities
        if (cardText.includes("pool")) amenities.push("Pool");
        if (cardText.includes("free wifi") || cardText.includes("free wi-fi")) amenities.push("Free WiFi");
        if (cardText.includes("parking")) amenities.push("Parking");
        if (cardText.includes("breakfast included") || cardText.includes("includes breakfast")) amenities.push("Breakfast Included");
        if (cardText.includes("spa") || cardText.includes("wellness")) amenities.push("Spa");
        if (cardText.includes("fitness") || cardText.includes("gym")) amenities.push("Fitness Center");
        if (cardText.includes("restaurant")) amenities.push("Restaurant");
        if (cardText.includes("air condition")) amenities.push("A/C");
        if (cardText.includes("pet friendly") || cardText.includes("pets allowed")) amenities.push("Pet Friendly");
        if (cardText.includes("hot tub") || cardText.includes("jacuzzi")) amenities.push("Hot Tub");
        if (cardText.includes("kitchen")) amenities.push("Kitchen");
        if (cardText.includes("balcony")) amenities.push("Balcony");
        if (cardText.includes("sea view") || cardText.includes("ocean view")) amenities.push("Ocean View");
        if (cardText.includes("free cancellation")) highlights.push("Free Cancellation");
        if (cardText.includes("no prepayment")) highlights.push("No Prepayment");

        // Extract thumbnail image URL
        const imgEl = card.querySelector('img[data-testid="image"]') as HTMLImageElement;
        const thumbnailUrl = imgEl?.src || null;

        // Extract availability status (e.g., "Only 2 rooms left", "Last booked 5 minutes ago")
        let availability: string | null = null;
        const availabilityPatterns = [
          /only\s*\d+\s*(rooms?|left)/i,
          /last\s*(booked|reserved)\s*\d+\s*(minutes?|hours?)\s*ago/i,
          /in\s*high\s*demand/i,
          /selling\s*fast/i,
        ];
        for (const pattern of availabilityPatterns) {
          const match = cardText.match(pattern);
          if (match) {
            availability = match[0];
            break;
          }
        }

        results.push({
          name,
          price,
          priceDisplay: priceText || "Price not shown",
          rating,
          ratingText: ratingDesc || ratingText,
          reviewCount,
          location,
          distanceToCenter,
          amenities,
          highlights,
          link,
          thumbnailUrl,
          availability,
        });
      });

      return results;
    });
  }

  /**
   * Extract hotel data from Booking.com's Apollo GraphQL cache.
   * This is more reliable than DOM scraping as it uses structured data.
   * Falls back gracefully if the cache structure changes.
   */
  private async extractHotelsFromAPI(): Promise<HotelResult[]> {
    if (!this.page) return [];

    return await this.page.evaluate(() => {
      try {
        // Access the Apollo cache embedded in the page
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        const cache = w.__caplaDataStore?.apollo?.cache?.data?.data;
        if (!cache) return [];

        const rootQuery = cache['ROOT_QUERY'];
        if (!rootQuery) return [];

        // searchQueries contains the search results
        const searchQueries = rootQuery.searchQueries;
        if (!searchQueries) return [];

        // Find the search key (complex key with query parameters)
        const searchKey = Object.keys(searchQueries).find(k => k.startsWith('search('));
        if (!searchKey) return [];

        const searchOutput = searchQueries[searchKey];
        if (!searchOutput) return [];

        // Get the results array
        const searchResults = searchOutput.results;
        if (!searchResults || !Array.isArray(searchResults)) return [];

        const results: HotelResult[] = [];

        for (const hotel of searchResults) {
          if (!hotel) continue;

          // Skip sponsored/native ad listings
          const persuasion = hotel.persuasion;
          if (persuasion?.showNativeAdLabel || persuasion?.nativeAdId) {
            continue;
          }

          // Extract name
          const name = hotel.displayName?.text || hotel.basicPropertyData?.pageName || 'Unknown';

          // Extract price
          let price: number | null = null;
          let priceDisplay = 'Price not shown';
          const priceInfo = hotel.priceDisplayInfoIrene?.displayPrice?.amountPerStay;
          if (priceInfo) {
            priceDisplay = priceInfo.amountRounded || priceInfo.amount || priceDisplay;
            price = typeof priceInfo.amountUnformatted === 'number' ? priceInfo.amountUnformatted : null;
          }

          // Extract rating and reviews from basicPropertyData.reviews
          let rating: number | null = null;
          let ratingText = '';
          let reviewCount: number | null = null;
          const reviews = hotel.basicPropertyData?.reviews;
          if (reviews) {
            rating = typeof reviews.totalScore === 'number' ? reviews.totalScore : null;
            ratingText = reviews.totalScoreTextTag?.translation || '';
            reviewCount = typeof reviews.reviewsCount === 'number' ? reviews.reviewsCount : null;
          }

          // Extract location
          const location = hotel.location?.displayLocation || '';
          const distanceToCenter = hotel.location?.mainDistance || '';

          // Build thumbnail URL
          let thumbnailUrl: string | null = null;
          const mainPhoto = hotel.basicPropertyData?.photos?.main;
          if (mainPhoto) {
            const relativeUrl = mainPhoto.highResJpegUrl?.relativeUrl ||
                               mainPhoto.highResUrl?.relativeUrl ||
                               mainPhoto.lowResJpegUrl?.relativeUrl;
            if (relativeUrl) {
              thumbnailUrl = `https://cf.bstatic.com${relativeUrl}`;
            }
          }

          // Build link with country code (required for API data to load on detail page)
          let link = '';
          const pageName = hotel.basicPropertyData?.pageName;
          const countryCode = hotel.basicPropertyData?.location?.countryCode;
          if (pageName && countryCode) {
            link = `https://www.booking.com/hotel/${countryCode}/${pageName}.html`;
          } else if (pageName) {
            // Fallback without country code (less reliable for API extraction)
            link = `https://www.booking.com/hotel/${pageName}.html`;
          }

          // Extract amenities and highlights
          const amenities: string[] = [];
          const highlights: string[] = [];

          // Sustainability
          if (hotel.propertySustainability?.isSustainable) {
            amenities.push('Sustainable');
          }

          // Policies
          const policies = hotel.policies;
          if (policies?.showFreeCancellation) {
            highlights.push('Free Cancellation');
          }
          if (policies?.showNoPrepayment) {
            highlights.push('No Prepayment');
          }
          if (policies?.showPetsAllowedForFree) {
            amenities.push('Pet Friendly');
          }

          // Meal plan
          if (hotel.mealPlanIncluded?.mealPlanType) {
            amenities.push('Breakfast Included');
          }

          // Extract availability info
          let availability: string | null = null;
          const soldOutInfo = hotel.soldOutInfo;
          if (soldOutInfo?.messages && soldOutInfo.messages.length > 0) {
            const msg = soldOutInfo.messages[0];
            if (msg?.text) {
              availability = msg.text;
            }
          }

          results.push({
            name,
            price,
            priceDisplay,
            rating,
            ratingText,
            reviewCount,
            location,
            distanceToCenter,
            amenities,
            highlights,
            link,
            thumbnailUrl,
            availability,
          });
        }

        return results;
      } catch {
        // If anything goes wrong with API extraction, return empty to trigger fallback
        return [];
      }
    });
  }

  /**
   * Extract hotel details from Booking.com's Apollo GraphQL cache on a hotel detail page.
   * This is more reliable than DOM scraping as it uses structured data.
   * Returns null if extraction fails (triggering DOM fallback).
   */
  private async extractHotelDetailsFromAPI(): Promise<Omit<HotelDetails, 'url'> | null> {
    if (!this.page) return null;

    return await this.page.evaluate(() => {
      try {
        // Access the Apollo cache embedded in the page
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        const cache = w.__caplaDataStore?.apollo?.cache?.data?.data;
        if (!cache) return null;

        // Helper to resolve __ref pointers
        const resolveRef = (ref: unknown): unknown => {
          if (ref && typeof ref === 'object' && '__ref' in ref) {
            return cache[(ref as { __ref: string }).__ref];
          }
          return ref;
        };

        // Find the Property entry - it has a key like 'Property:{"id":6523595}'
        const propertyKey = Object.keys(cache).find(k => k.startsWith('Property:{"id":'));
        if (!propertyKey) return null;

        const property = cache[propertyKey];
        if (!property) return null;

        // Extract hotel ID from the property key
        const idMatch = propertyKey.match(/Property:\{"id":(\d+)\}/);
        const hotelId = idMatch ? idMatch[1] : null;

        // Get BasicPropertyData for address and location
        const basicDataKey = hotelId ? `BasicPropertyData:${hotelId}` : null;
        const basicData = basicDataKey ? cache[basicDataKey] : null;

        // Extract name
        const name = property.name || basicData?.name || 'Unknown';

        // Extract rating and reviews from property.reviews
        let rating: number | null = null;
        let ratingText = '';
        let reviewCount: number | null = null;

        const reviews = property.reviews;
        if (reviews) {
          reviewCount = typeof reviews.reviewsCount === 'number' ? reviews.reviewsCount : null;
          
          // Find the total score from questions array
          const questions = reviews.questions;
          if (Array.isArray(questions)) {
            const totalQ = questions.find((q: { name?: string }) => q?.name === 'total');
            if (totalQ && typeof totalQ.score === 'number') {
              const score = totalQ.score;
              rating = score;
              // Generate rating text based on score
              if (score >= 9) ratingText = 'Superb';
              else if (score >= 8) ratingText = 'Very Good';
              else if (score >= 7) ratingText = 'Good';
              else if (score >= 6) ratingText = 'Pleasant';
              else ratingText = 'Review score';
            }
          }
        }

        // Extract address from BasicPropertyData
        const address = basicData?.location?.formattedAddress || 
                       basicData?.location?.formattedAddressShort || '';

        // Extract star rating from accommodation type
        let starRating: number | null = null;
        const accomType = resolveRef(property.accommodationType);
        if (accomType && typeof accomType === 'object' && 'starRating' in accomType) {
          starRating = (accomType as { starRating?: number }).starRating || null;
        }

        // Extract check-in/out times from houseRules
        let checkInTime = '';
        let checkOutTime = '';
        const houseRules = property.houseRules;
        if (houseRules?.checkinCheckoutTimes) {
          const times = houseRules.checkinCheckoutTimes;
          if (times.checkinTimeRange) {
            const from = times.checkinTimeRange.fromFormatted;
            const until = times.checkinTimeRange.untilFormatted;
            if (from && until) {
              checkInTime = `${from} - ${until}`;
            } else if (from) {
              checkInTime = `From ${from}`;
            } else if (until) {
              checkInTime = `Until ${until}`;
            }
          }
          if (times.checkoutTimeRange) {
            const from = times.checkoutTimeRange.fromFormatted;
            const until = times.checkoutTimeRange.untilFormatted;
            if (from && until) {
              checkOutTime = `${from} - ${until}`;
            } else if (until) {
              checkOutTime = `Until ${until}`;
            } else if (from) {
              checkOutTime = `From ${from}`;
            }
          }
        }

        // Extract popular facilities from accommodationHighlights
        const popularFacilities: string[] = [];
        const highlightKeys = Object.keys(property).filter(k => k.startsWith('accommodationHighlights('));
        for (const key of highlightKeys) {
          const highlights = property[key];
          if (Array.isArray(highlights)) {
            for (const item of highlights) {
              const entities = item?.entities;
              if (Array.isArray(entities)) {
                for (const entity of entities) {
                  // Direct title (like BreakfastHighlight)
                  if (entity?.title) {
                    popularFacilities.push(entity.title);
                  }
                  // Resolve __ref for GenericFacilityHighlight, WifiFacilityHighlight, etc.
                  const resolved = resolveRef(entity);
                  if (resolved && typeof resolved === 'object' && 'title' in resolved) {
                    const title = (resolved as { title?: string }).title;
                    if (title && !popularFacilities.includes(title)) {
                      popularFacilities.push(title);
                    }
                  }
                }
              }
            }
          }
        }

        // Extract all facilities from highlights (popularity based)
        const allFacilities: string[] = [];
        const facilityKeys = Object.keys(property).filter(k => k.startsWith('highlights('));
        for (const key of facilityKeys) {
          const highlightData = property[key];
          const entities = highlightData?.entities;
          if (Array.isArray(entities)) {
            for (const entity of entities) {
              // Skip Meal type entries
              if (entity?.__typename === 'Meal') continue;
              
              const resolved = resolveRef(entity);
              if (resolved && typeof resolved === 'object') {
                // For BaseFacility, look at instances
                const instances = (resolved as { instances?: unknown[] }).instances;
                if (Array.isArray(instances)) {
                  for (const inst of instances) {
                    const resolvedInst = resolveRef(inst);
                    if (resolvedInst && typeof resolvedInst === 'object' && 'title' in resolvedInst) {
                      const title = (resolvedInst as { title?: string }).title;
                      if (title && !allFacilities.includes(title)) {
                        allFacilities.push(title);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Extract photos from propertyGallery
        const photos: string[] = [];
        const galleryKeys = Object.keys(property).filter(k => k.startsWith('propertyGallery('));
        for (const key of galleryKeys) {
          const gallery = property[key];
          
          // Main photo
          if (gallery?.mainPhoto) {
            const mainPhoto = resolveRef(gallery.mainPhoto);
            if (mainPhoto && typeof mainPhoto === 'object') {
              // Look for resource with max500 or max1024x768
              const photoObj = mainPhoto as Record<string, unknown>;
              const resourceKey = Object.keys(photoObj).find(k => k.includes('max500') || k.includes('max1024'));
              if (resourceKey) {
                const resource = photoObj[resourceKey] as { absoluteUrl?: string };
                if (resource?.absoluteUrl) {
                  photos.push(resource.absoluteUrl);
                }
              }
            }
          }

          // Room photos
          const roomPhotos = gallery?.roomPhotos;
          if (Array.isArray(roomPhotos)) {
            for (const room of roomPhotos) {
              const roomPhotosList = room?.photos;
              if (Array.isArray(roomPhotosList) && photos.length < 5) {
                for (const photoRef of roomPhotosList) {
                  if (photos.length >= 5) break;
                  const photo = resolveRef(photoRef);
                  if (photo && typeof photo === 'object') {
                    const photoObj = photo as Record<string, unknown>;
                    const resourceKey = Object.keys(photoObj).find(k => k.includes('max500') || k.includes('max1024'));
                    if (resourceKey) {
                      const resource = photoObj[resourceKey] as { absoluteUrl?: string };
                      if (resource?.absoluteUrl && !photos.includes(resource.absoluteUrl)) {
                        photos.push(resource.absoluteUrl);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Extract room types from property.rooms
        const roomTypes: string[] = [];
        const rooms = property.rooms;
        if (Array.isArray(rooms)) {
          for (const roomRef of rooms) {
            const room = resolveRef(roomRef);
            if (room && typeof room === 'object') {
              const roomObj = room as { name?: string; description?: string };
              const roomName = roomObj.name || roomObj.description;
              if (roomName && !roomTypes.includes(roomName)) {
                roomTypes.push(roomName);
              }
            }
          }
        }

        // Extract location info
        let locationInfo = '';
        if (basicData?.location) {
          const loc = basicData.location;
          const parts: string[] = [];
          if (loc.city) parts.push(loc.city);
          if (loc.countryCode) parts.push(loc.countryCode.toUpperCase());
          locationInfo = parts.join(', ');
          if (loc.latitude && loc.longitude) {
            locationInfo += ` (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`;
          }
        }

        // Extract review category scores for highlights
        const guestReviewHighlights: string[] = [];
        if (reviews?.questions && Array.isArray(reviews.questions)) {
          const categoryNames: Record<string, string> = {
            'hotel_staff': 'Staff',
            'hotel_location': 'Location', 
            'hotel_clean': 'Cleanliness',
            'hotel_comfort': 'Comfort',
            'hotel_value': 'Value for money',
            'hotel_services': 'Facilities',
            'hotel_free_wifi': 'Free WiFi'
          };
          
          for (const q of reviews.questions) {
            if (q?.name && q.name !== 'total' && typeof q.score === 'number') {
              const displayName = categoryNames[q.name] || q.name;
              if (categoryNames[q.name]) {
                guestReviewHighlights.push(`${displayName}: ${q.score.toFixed(1)}`);
              }
            }
          }
        }

        // Validate we have meaningful data before returning
        // Name should be a proper hotel name (at least 3 chars, not 'Unknown')
        if (!name || name === 'Unknown' || name.length < 3) {
          return null; // Trigger DOM fallback
        }

        // Note: Description, pricePerNight, totalPrice, nearbyAttractions may need DOM fallback
        // as they're not consistently in the Apollo cache or are dynamic
        return {
          name,
          rating,
          ratingText,
          reviewCount,
          starRating,
          address,
          description: '', // Not typically in cache, will need DOM fallback if needed
          highlights: popularFacilities.slice(0, 5).join(', '),
          pricePerNight: null, // Dynamic, not in cache
          priceDisplay: '',
          totalPrice: '',
          checkInTime,
          checkOutTime,
          popularFacilities: popularFacilities.slice(0, 15),
          allFacilities: allFacilities.slice(0, 30),
          roomTypes: roomTypes.slice(0, 5),
          photos: photos.slice(0, 5),
          nearbyAttractions: [], // Would need propertySurroundings query
          guestReviewHighlights: guestReviewHighlights.slice(0, 7),
          locationInfo
        };
      } catch {
        // If anything goes wrong with API extraction, return null to trigger fallback
        return null;
      }
    });
  }

  /**
   * Fetch room facilities via Booking.com's GraphQL API.
   * This provides detailed amenities for each room type (AC, TV, bathroom details, etc.)
   * Must be called when already on a hotel page with an active session.
   * 
   * @param hotelId - The numeric hotel ID (e.g., 6523595)
   * @param checkIn - Check-in date in YYYY-MM-DD format
   * @param checkOut - Check-out date in YYYY-MM-DD format
   * @returns Map of roomId to array of amenity categories
   */
  private async fetchRoomFacilitiesGraphQL(
    hotelId: string,
    checkIn: string,
    checkOut: string
  ): Promise<Map<string, RoomAmenityCategory[]>> {
    if (!this.page) return new Map();
    
    try {
      const result = await this.page.evaluate(
        async ({ hotelId, checkIn, checkOut }) => {
          const query = `
            query RoomPageDesktopRDS($rdsInput: RDSRoomDetailQueryInput!) {
              roomDetail(roomDetailQueryInput: $rdsInput) {
                categorizedFacilitiesForAllRooms {
                  roomId
                  categorizedFacilities {
                    category
                    facilities {
                      name
                      id
                    }
                  }
                }
              }
            }
          `;

          const variables = {
            rdsInput: {
              hotelId: String(hotelId),
              searchConfig: {
                searchConfigDate: {
                  checkin: checkIn,
                  checkout: checkOut,
                },
                nbRooms: 1,
                nbAdults: 2,
                nbChildren: 0,
                childrenAges: [],
              },
              highlightedBlocks: [],
              selectedFilters: '',
              travelReason: 'LEISURE',
            },
          };

          try {
            const response = await fetch('/dml/graphql', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-booking-topic': 'capla_browser_b-property-web-property-page',
                'x-booking-context-action-name': 'hotel',
                'apollographql-client-name': 'b-property-web-property-page_rust',
              },
              body: JSON.stringify({
                operationName: 'RoomPageDesktopRDS',
                variables,
                query,
              }),
            });

            if (!response.ok) {
              return { error: `HTTP ${response.status}` };
            }

            const data = await response.json();
            return data;
          } catch (e: unknown) {
            return { error: e instanceof Error ? e.message : 'Unknown error' };
          }
        },
        { hotelId, checkIn, checkOut }
      );

      if ('error' in result) {
        logger.debug({ error: result.error }, 'GraphQL room facilities fetch failed');
        return new Map();
      }

      // Parse the response into our map structure
      const facilitiesMap = new Map<string, RoomAmenityCategory[]>();
      const roomData = result?.data?.roomDetail?.categorizedFacilitiesForAllRooms || [];

      for (const room of roomData) {
        const roomId = String(room.roomId);
        const categories: RoomAmenityCategory[] = [];

        for (const cat of room.categorizedFacilities || []) {
          categories.push({
            category: cat.category || 'General',
            items: (cat.facilities || []).map((f: { name?: string }) => f.name || '').filter(Boolean),
          });
        }

        if (categories.length > 0) {
          facilitiesMap.set(roomId, categories);
        }
      }

      logger.debug({ roomCount: facilitiesMap.size }, 'Fetched room facilities via GraphQL');
      return facilitiesMap;
    } catch (error) {
      logger.debug({ error }, 'Failed to fetch room facilities via GraphQL');
      return new Map();
    }
  }

  /**
   * Extract hotel ID from the current page URL or DOM.
   * Booking.com hotel IDs are typically in the URL path or data attributes.
   */
  private async extractHotelId(): Promise<string | null> {
    if (!this.page) return null;

    return await this.page.evaluate(() => {
      // Try to get from URL path (e.g., /hotel/fr/hotel-name.html?... contains ID in data)
      // Actually, the ID is often in data attributes or Apollo cache
      
      // Method 1: Look for data-hotel-id attribute
      const hotelIdEl = document.querySelector('[data-hotel-id]');
      if (hotelIdEl) {
        return hotelIdEl.getAttribute('data-hotel-id');
      }

      // Method 2: Look in Apollo cache
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const cache = w.__caplaDataStore?.apollo?.cache?.data?.data;
      if (cache) {
        const propertyKey = Object.keys(cache).find(k => k.startsWith('Property:{"id":'));
        if (propertyKey) {
          const match = propertyKey.match(/Property:\{"id":(\d+)\}/);
          if (match && match[1]) return match[1];
        }
      }

      // Method 3: Look for form inputs with hotel_id
      const hotelInput = document.querySelector<HTMLInputElement>('input[name="hotel_id"]');
      if (hotelInput?.value) return hotelInput.value;

      // Method 4: Look in data-block-id attributes (format: roomTypeId_policyId_hotelId_...)
      const blockEl = document.querySelector('[data-block-id]');
      if (blockEl) {
        const blockId = blockEl.getAttribute('data-block-id') || '';
        const parts = blockId.split('_');
        // Hotel ID is typically in position 2 (after roomTypeId and policyId)
        const potentialHotelId = parts[2];
        if (parts.length >= 3 && potentialHotelId && /^\d{5,}$/.test(potentialHotelId)) {
          return potentialHotelId;
        }
      }

      return null;
    });
  }

  /**
   * Extract reviews data from Booking.com's Apollo GraphQL cache.
   * Returns null if extraction fails (triggering DOM fallback).
   */
  private async extractReviewsFromAPI(): Promise<{
    hotelName: string;
    overallRating: number | null;
    totalReviews: number;
    ratingBreakdown: RatingBreakdown;
    reviews: Review[];
  } | null> {
    if (!this.page) return null;

    return await this.page.evaluate(() => {
      try {
        // Access the Apollo cache embedded in the page
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        const cache = w.__caplaDataStore?.apollo?.cache?.data?.data;
        if (!cache) return null;

        // Helper to resolve __ref pointers
        const resolveRef = (ref: unknown): unknown => {
          if (ref && typeof ref === 'object' && '__ref' in ref) {
            return cache[(ref as { __ref: string }).__ref];
          }
          return ref;
        };

        // Find the Property entry - it has a key like 'Property:{"id":6523595}'
        const propertyKey = Object.keys(cache).find(k => k.startsWith('Property:{"id":'));
        if (!propertyKey) return null;

        const property = cache[propertyKey];
        if (!property) return null;

        // Extract hotel ID from the property key
        const idMatch = propertyKey.match(/Property:\{"id":(\d+)\}/);
        const hotelId = idMatch ? idMatch[1] : null;

        // Get BasicPropertyData for hotel name
        const basicDataKey = hotelId ? `BasicPropertyData:${hotelId}` : null;
        const basicData = basicDataKey ? cache[basicDataKey] : null;

        // Extract hotel name
        const hotelName = property.name || basicData?.name || '';

        // Extract overall rating, total reviews, and rating breakdown from property.reviews
        let overallRating: number | null = null;
        let totalReviews = 0;
        const ratingBreakdown: {
          staff: number | null;
          facilities: number | null;
          cleanliness: number | null;
          comfort: number | null;
          valueForMoney: number | null;
          location: number | null;
          freeWifi: number | null;
        } = {
          staff: null,
          facilities: null,
          cleanliness: null,
          comfort: null,
          valueForMoney: null,
          location: null,
          freeWifi: null,
        };

        const reviewsData = property.reviews;
        if (reviewsData) {
          totalReviews = typeof reviewsData.reviewsCount === 'number' ? reviewsData.reviewsCount : 0;

          // Map question names to breakdown fields
          const questionMap: Record<string, keyof typeof ratingBreakdown> = {
            'hotel_staff': 'staff',
            'hotel_services': 'facilities',
            'hotel_clean': 'cleanliness',
            'hotel_comfort': 'comfort',
            'hotel_value': 'valueForMoney',
            'hotel_location': 'location',
            'hotel_free_wifi': 'freeWifi',
          };

          const questions = reviewsData.questions;
          if (Array.isArray(questions)) {
            for (const q of questions) {
              if (!q?.name || typeof q.score !== 'number') continue;
              
              if (q.name === 'total') {
                overallRating = q.score;
              } else {
                const breakdownKey = questionMap[q.name];
                if (breakdownKey) {
                  ratingBreakdown[breakdownKey] = q.score;
                }
              }
            }
          }
        }

        // Extract individual reviews from FeaturedReview entries
        const reviews: Array<{
          title: string;
          rating: number | null;
          date: string;
          travelerType: string;
          stayDate: string;
          roomType: string;
          nightsStayed: string;
          positive: string;
          negative: string;
          country: string;
        }> = [];

        // Map customer types to display names
        const customerTypeMap: Record<string, string> = {
          'SOLO_TRAVELLER': 'Solo traveler',
          'YOUNG_COUPLE': 'Couple',
          'MATURE_COUPLE': 'Couple',
          'FAMILY_WITH_YOUNG_CHILDREN': 'Family with young children',
          'FAMILY_WITH_OLDER_CHILDREN': 'Family with older children',
          'WITH_FRIENDS': 'Group of friends',
          'BUSINESS': 'Business traveler',
        };

        // Map country codes to names
        const countryCodeMap: Record<string, string> = {
          'us': 'United States',
          'gb': 'United Kingdom',
          'fr': 'France',
          'de': 'Germany',
          'es': 'Spain',
          'it': 'Italy',
          'nl': 'Netherlands',
          'be': 'Belgium',
          'ch': 'Switzerland',
          'au': 'Australia',
          'ca': 'Canada',
          'jp': 'Japan',
          'cn': 'China',
          'kr': 'South Korea',
          'br': 'Brazil',
          'mx': 'Mexico',
          'in': 'India',
          'ru': 'Russia',
          'pl': 'Poland',
          'se': 'Sweden',
          'no': 'Norway',
          'dk': 'Denmark',
          'fi': 'Finland',
          'at': 'Austria',
          'pt': 'Portugal',
          'gr': 'Greece',
          'tr': 'Turkey',
          'ie': 'Ireland',
          'nz': 'New Zealand',
          'za': 'South Africa',
          'ar': 'Argentina',
          'cl': 'Chile',
          'co': 'Colombia',
          'th': 'Thailand',
          'sg': 'Singapore',
          'my': 'Malaysia',
          'id': 'Indonesia',
          'ph': 'Philippines',
          'vn': 'Vietnam',
          'ae': 'United Arab Emirates',
          'sa': 'Saudi Arabia',
          'eg': 'Egypt',
          'il': 'Israel',
          'cz': 'Czech Republic',
          'hu': 'Hungary',
          'ro': 'Romania',
        };

        // Find all FeaturedReview entries
        const reviewKeys = Object.keys(cache).filter(k => k.startsWith('FeaturedReview:'));
        
        for (const key of reviewKeys) {
          const review = cache[key];
          if (!review) continue;

          // Format the date from Unix timestamp
          let dateStr = '';
          if (typeof review.completed === 'number') {
            const date = new Date(review.completed * 1000);
            dateStr = date.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
          }

          // Get room type from ref
          let roomType = '';
          const roomRef = resolveRef(review.roomType);
          if (roomRef && typeof roomRef === 'object' && 'name' in roomRef) {
            roomType = (roomRef as { name?: string }).name || '';
          }

          // Get country name from code
          const countryCode = (review.guestCountryCode || '').toLowerCase();
          const country = countryCodeMap[countryCode] || countryCode.toUpperCase();

          // Get traveler type display name
          const travelerType = customerTypeMap[review.customerType] || review.customerType || '';

          reviews.push({
            title: review.title || '',
            rating: typeof review.averageScore === 'number' ? review.averageScore : null,
            date: dateStr,
            travelerType,
            stayDate: '', // Not available in FeaturedReview
            roomType,
            nightsStayed: '', // Not available in FeaturedReview
            positive: review.positiveText || '',
            negative: review.negativeText || '',
            country,
          });
        }

        // Sort reviews by date (newest first - higher timestamp = newer)
        reviews.sort((a, b) => {
          // Parse dates back for comparison
          const dateA = new Date(a.date).getTime() || 0;
          const dateB = new Date(b.date).getTime() || 0;
          return dateB - dateA;
        });

        // Validate we have meaningful data
        if (!hotelName || hotelName.length < 3) {
          return null;
        }

        return {
          hotelName,
          overallRating,
          totalReviews,
          ratingBreakdown,
          reviews,
        };
      } catch {
        return null;
      }
    });
  }

  private scoreAndFilterHotels(
    hotels: HotelResult[],
    filters: HotelFilters
  ): HotelResult[] {
    return hotels
      .map((hotel) => {
        let score = 0;
        const matchReasons: string[] = [];
        const amenitiesLower = hotel.amenities.map((a) => a.toLowerCase());
        const highlightsLower = hotel.highlights.map((h) => h.toLowerCase());
        const allText = [...amenitiesLower, ...highlightsLower].join(" ");

        // Score based on requested filters
        if (filters.beachfront || filters.beachAccess) {
          if (allText.includes("beach")) {
            score += 20;
            matchReasons.push("Near beach");
          }
        }

        if (filters.freeWifi) {
          if (allText.includes("wifi") || allText.includes("wi-fi")) {
            score += 10;
            matchReasons.push("Has WiFi");
          }
        }

        if (filters.pool) {
          if (allText.includes("pool")) {
            score += 10;
            matchReasons.push("Has pool");
          }
        }

        if (filters.breakfast) {
          if (allText.includes("breakfast")) {
            score += 10;
            matchReasons.push("Breakfast included");
          }
        }

        if (filters.parking || filters.freeParking) {
          if (allText.includes("parking")) {
            score += 10;
            matchReasons.push("Has parking");
          }
        }

        if (filters.spa) {
          if (allText.includes("spa") || allText.includes("wellness")) {
            score += 10;
            matchReasons.push("Has spa");
          }
        }

        if (filters.fitness) {
          if (allText.includes("gym") || allText.includes("fitness")) {
            score += 10;
            matchReasons.push("Has gym");
          }
        }
        
        if (filters.hotTub) {
          if (allText.includes("hot tub") || allText.includes("jacuzzi")) {
            score += 10;
            matchReasons.push("Has hot tub");
          }
        }
        
        if (filters.kitchen) {
          if (allText.includes("kitchen")) {
            score += 10;
            matchReasons.push("Has kitchen");
          }
        }
        
        if (filters.balcony) {
          if (allText.includes("balcony")) {
            score += 10;
            matchReasons.push("Has balcony");
          }
        }
        
        if (filters.oceanView) {
          if (allText.includes("ocean view") || allText.includes("sea view")) {
            score += 15;
            matchReasons.push("Ocean view");
          }
        }
        
        if (filters.freeCancellation) {
          if (allText.includes("free cancellation")) {
            score += 5;
            matchReasons.push("Free cancellation");
          }
        }

        // Bonus for high ratings
        if (hotel.rating) {
          if (hotel.rating >= 9) {
            score += 15;
            matchReasons.push(`Excellent rating (${hotel.rating})`);
          } else if (hotel.rating >= 8) {
            score += 10;
            matchReasons.push(`Great rating (${hotel.rating})`);
          }
        }

        // Bonus for many reviews (more trustworthy)
        if (hotel.reviewCount && hotel.reviewCount > 500) {
          score += 5;
          matchReasons.push(`${hotel.reviewCount} reviews`);
        }

        return {
          ...hotel,
          matchScore: score,
          matchReasons,
        };
      })
      .filter((hotel) => {
        // Filter out hotels that don't meet minimum criteria
        if (filters.minRating && hotel.rating && hotel.rating < filters.minRating) {
          return false;
        }
        if (filters.minPrice && hotel.price && hotel.price < filters.minPrice) {
          return false;
        }
        if (filters.maxPrice && hotel.price && hotel.price > filters.maxPrice) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }

  async getHotelDetails(hotelUrl: string): Promise<Record<string, unknown>> {
    if (!this.page) {
      throw new HotelSearchError(
        "Browser not initialized. Call init() first.",
        ErrorCodes.BROWSER_NOT_INITIALIZED,
        false
      );
    }

    return await retryWithBackoff(
      async () => {
        // Enforce rate limiting
        await this.enforceRateLimit();
        
        try {
          await this.page!.goto(hotelUrl, { 
            waitUntil: "networkidle",
            timeout: 30000 
          });
        } catch (error) {
          const err = error as Error;
          if (err.message.includes("timeout") || err.message.includes("Timeout")) {
            throw new HotelSearchError(
              "Page load timed out. The server may be slow or unavailable.",
              ErrorCodes.TIMEOUT,
              true
            );
          }
          throw new HotelSearchError(
            `Navigation failed: ${err.message}`,
            ErrorCodes.NAVIGATION_FAILED,
            true
          );
        }
        
        await this.page!.waitForTimeout(2000);
        
        // Check for blocking/CAPTCHA
        await this.checkForBlocking();
        
        await this.dismissPopups();

        // Extract detailed information from hotel page
        return await this.page!.evaluate(() => {
          const details: Record<string, unknown> = {};

          // Hotel name
          const nameEl = document.querySelector('h2[class*="pp-header"]');
          details.name = nameEl?.textContent?.trim();

          // Description
          const descEl = document.querySelector('[data-testid="property-description"]');
          details.description = descEl?.textContent?.trim();

          // All facilities
          const facilityEls = document.querySelectorAll('[data-testid="property-section-facilities"] li');
          details.facilities = Array.from(facilityEls).map((el) => el.textContent?.trim());

          // Photos
          const photoEls = document.querySelectorAll('[data-testid="gallery-image"] img');
          details.photos = Array.from(photoEls)
            .slice(0, 5)
            .map((el) => (el as HTMLImageElement).src);

          // Popular facilities highlighted
          const popularFacilities = document.querySelectorAll('[data-testid="property-most-popular-facilities"] span');
          details.popularFacilities = Array.from(popularFacilities).map((el) => el.textContent?.trim());

          return details;
        });
      },
      DEFAULT_RETRY_CONFIG,
      (attempt, error, delayMs) => {
        logger.warn(
          { attempt, error: error.message, retryInMs: delayMs },
          "Get details attempt failed, retrying"
        );
      }
    );
  }

  async takeScreenshot(path: string): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");
    await this.page.screenshot({ path, fullPage: false });
  }

  async getPageContent(): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized");
    return await this.page.content();
  }

  /**
   * Get detailed hotel information for comparison
   */
  async getHotelDetailsForComparison(hotelUrl: string): Promise<HotelDetails> {
    if (!this.page) {
      throw new HotelSearchError(
        "Browser not initialized. Call init() first.",
        ErrorCodes.BROWSER_NOT_INITIALIZED,
        false
      );
    }

    return await retryWithBackoff(
      async () => {
        await this.enforceRateLimit();
        
        try {
          await this.page!.goto(hotelUrl, { 
            waitUntil: "networkidle",
            timeout: 30000 
          });
        } catch (error) {
          const err = error as Error;
          if (err.message.includes("timeout") || err.message.includes("Timeout")) {
            throw new HotelSearchError(
              "Page load timed out.",
              ErrorCodes.TIMEOUT,
              true
            );
          }
          throw new HotelSearchError(
            `Navigation failed: ${err.message}`,
            ErrorCodes.NAVIGATION_FAILED,
            true
          );
        }
        
        await this.page!.waitForTimeout(2000);
        await this.checkForBlocking();
        await this.dismissPopups();

        // Try API extraction first (more reliable structured data)
        const apiDetails = await this.extractHotelDetailsFromAPI();
        if (apiDetails) {
          logger.debug("Successfully extracted hotel details from API cache");
          return {
            ...apiDetails,
            url: hotelUrl,
          };
        }

        logger.debug("API extraction returned no results, falling back to DOM scraping");

        // Extract comprehensive hotel details using evaluate with string to avoid __name compilation issues
        const details = await this.page!.evaluate(`
          (function() {
            function getText(selector) {
              var el = document.querySelector(selector);
              return el && el.textContent ? el.textContent.trim() : "";
            }
            
            function getTexts(selector) {
              var elements = document.querySelectorAll(selector);
              var result = [];
              for (var i = 0; i < elements.length; i++) {
                var text = elements[i].textContent;
                if (text) {
                  text = text.trim();
                  if (text.length > 0) result.push(text);
                }
              }
              return result;
            }
            
            function getUniqueTexts(selector) {
              var texts = getTexts(selector);
              var seen = {};
              var result = [];
              for (var i = 0; i < texts.length; i++) {
                if (!seen[texts[i]]) {
                  seen[texts[i]] = true;
                  result.push(texts[i]);
                }
              }
              return result;
            }

            // Name - h2 is cleaner than h1 on Booking.com property pages
            var name = getText('h2');
            if (!name) name = getText('h1').split('(')[0].trim(); // fallback, strip suffix

            // Rating - parse from review-score-component which contains "Scored 7.4 7.4Rated good Good · 11 reviews"
            var ratingEl = document.querySelector('[data-testid="review-score-component"]');
            var ratingFullText = ratingEl ? ratingEl.textContent || "" : "";
            
            // Extract numeric rating (first number after "Scored")
            var ratingMatch = ratingFullText.match(/Scored\\s+([\\d.]+)/i);
            var rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
            
            // Extract rating description (Good, Excellent, etc.)
            var descMatch = ratingFullText.match(/Rated\\s*\\w+\\s*(\\w+)/i);
            var ratingDesc = descMatch ? descMatch[1] : "";
            if (!ratingDesc) {
              // Try alternate pattern
              var altMatch = ratingFullText.match(/(Exceptional|Superb|Excellent|Very Good|Good|Pleasant|Review score)/i);
              ratingDesc = altMatch ? altMatch[1] : "";
            }
            
            // Review count - look for number followed by "review"
            var reviewMatch = ratingFullText.match(/([\\d,]+)\\s*reviews?/i);
            var reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, "")) : null;

            // Star rating (for hotels)
            var starEl = document.querySelector('[data-testid="rating-stars"]');
            var starCount = starEl ? starEl.querySelectorAll('span[class*="star"], svg').length : null;
            // Sometimes stars are indicated by aria-label
            if (!starCount) {
              var starLabel = document.querySelector('[aria-label*="star"]');
              if (starLabel) {
                var labelMatch = starLabel.getAttribute('aria-label').match(/(\\d+)/);
                starCount = labelMatch ? parseInt(labelMatch[1]) : null;
              }
            }

            // Address - from header address wrapper, clean up extra content
            var address = "";
            var addressWrapper = document.querySelector('[data-testid="PropertyHeaderAddressDesktop-wrapper"]');
            if (addressWrapper) {
              // Get all spans and find the one with the actual address
              var spans = addressWrapper.querySelectorAll('span');
              for (var i = 0; i < spans.length; i++) {
                var text = spans[i].textContent ? spans[i].textContent.trim() : "";
                // Address typically contains comma-separated parts ending with country
                if (text.length > 10 && text.indexOf(",") > 0) {
                  // Cut off at common suffixes that indicate end of address
                  var cutoffs = ["Excellent location", "Great location", "Good location", "Very good location", "show map", "– rated", "After booking"];
                  for (var j = 0; j < cutoffs.length; j++) {
                    var idx = text.indexOf(cutoffs[j]);
                    if (idx > 0) {
                      text = text.substring(0, idx).trim();
                      break;
                    }
                  }
                  if (text.length > 10) {
                    address = text;
                    break;
                  }
                }
              }
            }
            if (!address) address = getText('[data-testid="property-header-location"]');

            // Description
            var description = getText('[data-testid="property-description"]');

            // Property highlights (size, bathroom, etc.)
            var highlights = getText('[data-testid="property-highlights"]');

            // Price - look in the reservation/booking section
            var priceDisplay = "";
            var pricePerNight = null;
            
            // Try multiple price selectors
            var priceSelectors = [
              '[data-testid="price-and-discounted-price"]',
              '[class*="prco-valign-middle-helper"]',
              '[class*="bui-price-display__value"]',
              'span[class*="price"]'
            ];
            
            for (var i = 0; i < priceSelectors.length; i++) {
              var priceEl = document.querySelector(priceSelectors[i]);
              if (priceEl && priceEl.textContent) {
                var text = priceEl.textContent.trim();
                // Look for currency symbol followed by number
                var match = text.match(/[\\$€£¥]\\s*([\\d,]+)/);
                if (match) {
                  priceDisplay = text;
                  pricePerNight = parseInt(match[1].replace(/,/g, ""));
                  break;
                }
              }
            }

            // Check-in/out times - try multiple approaches
            var checkInTime = getText('[data-testid="check-in-time"]');
            var checkOutTime = getText('[data-testid="check-out-time"]');
            
            // If not found, look in policies section
            if (!checkInTime) {
              var policyText = getText('[data-testid="policy-summary"]') || "";
              var checkInMatch = policyText.match(/check-in[:\\s]*(\\d{1,2}:\\d{2})/i);
              checkInTime = checkInMatch ? checkInMatch[1] : "";
            }
            if (!checkOutTime) {
              var policyText = getText('[data-testid="policy-summary"]') || "";
              var checkOutMatch = policyText.match(/check-out[:\\s]*(\\d{1,2}:\\d{2})/i);
              checkOutTime = checkOutMatch ? checkOutMatch[1] : "";
            }

            // Popular facilities - from the wrapper, get unique spans
            var facilitiesWrapper = document.querySelector('[data-testid="property-most-popular-facilities-wrapper"]');
            var popularFacilities = [];
            if (facilitiesWrapper) {
              var spans = facilitiesWrapper.querySelectorAll('span');
              var seen = {};
              for (var i = 0; i < spans.length; i++) {
                var text = spans[i].textContent ? spans[i].textContent.trim() : "";
                // Skip labels like "Most popular amenities" and short items
                if (text && text.length > 2 && text.length < 50 && !seen[text] && 
                    text.indexOf("Most popular") === -1 && text.indexOf("amenities") === -1) {
                  seen[text] = true;
                  popularFacilities.push(text);
                }
              }
            }
            
            // If still empty, try property-highlights
            if (popularFacilities.length === 0 && highlights) {
              // Parse highlights like "Private bathroomFree WifiShower..."
              var items = highlights.split(/(?=[A-Z][a-z])/);
              for (var i = 0; i < items.length; i++) {
                var item = items[i].trim();
                if (item && item.length > 2) popularFacilities.push(item);
              }
            }

            // All facilities from facilities section
            var allFacilities = getUniqueTexts('[data-testid="property-section-facilities"] li');
            if (allFacilities.length === 0) {
              allFacilities = getUniqueTexts('[data-testid="Property-Facilities-Tab-Content"] li');
            }

            // Room types
            var roomTypes = getUniqueTexts('[data-testid="room-name"]');

            // Photos from gallery
            var photoEls = document.querySelectorAll('[data-testid="GalleryUnifiedDesktop-wrapper"] img, [class*="gallery"] img');
            var photos = [];
            var seenPhotos = {};
            for (var i = 0; i < photoEls.length && photos.length < 5; i++) {
              var src = photoEls[i].src;
              if (src && src.indexOf("data:") === -1 && !seenPhotos[src]) {
                seenPhotos[src] = true;
                photos.push(src);
              }
            }

            // Location info from map
            var locationInfo = getText('[data-testid="map-entry-point-desktop"]');

            return {
              name: name,
              rating: rating,
              ratingText: ratingDesc,
              reviewCount: reviewCount,
              starRating: starCount,
              address: address,
              description: description.slice(0, 500),
              highlights: highlights,
              pricePerNight: pricePerNight,
              priceDisplay: priceDisplay,
              totalPrice: "",
              checkInTime: checkInTime,
              checkOutTime: checkOutTime,
              popularFacilities: popularFacilities.slice(0, 15),
              allFacilities: allFacilities.slice(0, 30),
              roomTypes: roomTypes.slice(0, 5),
              photos: photos,
              nearbyAttractions: [],
              guestReviewHighlights: [],
              locationInfo: locationInfo
            };
          })()
        `) as Omit<HotelDetails, 'url'>;

        return {
          ...details,
          url: hotelUrl,
        };
      },
      DEFAULT_RETRY_CONFIG,
      (attempt, error, delayMs) => {
        logger.warn(
          { attempt, error: error.message, retryInMs: delayMs },
          "Get hotel details for comparison failed, retrying"
        );
      }
    );
  }

  /**
   * Compare multiple hotels side-by-side
   */
  async compareHotels(hotelUrls: string[]): Promise<HotelDetails[]> {
    if (hotelUrls.length < 2 || hotelUrls.length > 3) {
      throw new HotelSearchError(
        "Please provide 2-3 hotel URLs to compare",
        "INVALID_INPUT",
        false
      );
    }

    const results: HotelDetails[] = [];
    
    for (const url of hotelUrls) {
      const details = await this.getHotelDetailsForComparison(url);
      results.push(details);
    }

    return results;
  }

  /**
   * Check availability for a specific hotel on given dates
   */
  async checkAvailability(params: {
    hotelUrl: string;
    checkIn: string;
    checkOut: string;
    guests?: number;
    rooms?: number;
  }): Promise<AvailabilityResult> {
    if (!this.page) {
      throw new HotelSearchError(
        "Browser not initialized. Call init() first.",
        ErrorCodes.BROWSER_NOT_INITIALIZED,
        false
      );
    }

    const { hotelUrl, checkIn, checkOut, guests = 2, rooms = 1 } = params;

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      throw new HotelSearchError(
        "Invalid date format. Use YYYY-MM-DD.",
        "INVALID_INPUT",
        false
      );
    }
    if (checkOutDate <= checkInDate) {
      throw new HotelSearchError(
        "Check-out date must be after check-in date.",
        "INVALID_INPUT",
        false
      );
    }

    return await retryWithBackoff(
      async () => {
        await this.enforceRateLimit();

        // Build URL with date parameters
        // Strip existing query params and add our own
        const baseUrl = hotelUrl.split("?")[0];
        const urlWithDates = `${baseUrl}?checkin=${checkIn}&checkout=${checkOut}&group_adults=${guests}&no_rooms=${rooms}&group_children=0`;

        try {
          await this.page!.goto(urlWithDates, {
            waitUntil: "networkidle",
            timeout: 30000,
          });
        } catch (error) {
          const err = error as Error;
          if (err.message.includes("timeout") || err.message.includes("Timeout")) {
            throw new HotelSearchError(
              "Page load timed out.",
              ErrorCodes.TIMEOUT,
              true
            );
          }
          throw new HotelSearchError(
            `Navigation failed: ${err.message}`,
            ErrorCodes.NAVIGATION_FAILED,
            true
          );
        }

        await this.page!.waitForTimeout(2000);
        await this.checkForBlocking();
        await this.dismissPopups();

        // Extract room availability using data attributes (primary) with DOM fallback
        const result = await this.page!.evaluate(`
          (function() {
            function getText(selector) {
              var el = document.querySelector(selector);
              return el && el.textContent ? el.textContent.trim() : "";
            }

            // Get hotel name
            var hotelName = getText('h2') || getText('h1').split('(')[0].trim() || "Unknown Hotel";

            var roomOptions = [];
            
            // ============================================================
            // STRATEGY 1: Extract from data-* attributes (most reliable)
            // Uses data-block-id, data-hotel-rounded-price, and data-fltrs
            // ============================================================
            
            // First, build maps of room type IDs to room names and bed types from header rows
            var roomNameMap = {};
            var bedTypeMap = {};
            var roomTypeHeaders = document.querySelectorAll('.hprt-roomtype-link');
            for (var h = 0; h < roomTypeHeaders.length; h++) {
              var header = roomTypeHeaders[h];
              var headerRow = header.closest('tr');
              var headerBlockId = headerRow ? headerRow.getAttribute('data-block-id') : null;
              if (headerBlockId && headerBlockId.indexOf('_') > 0) {
                var headerRoomTypeId = headerBlockId.split('_')[0];
                var headerRoomName = header.textContent ? header.textContent.trim() : '';
                if (headerRoomName) {
                  roomNameMap[headerRoomTypeId] = headerRoomName;
                }
                // Also capture bed type from header row
                var bedEl = headerRow.querySelector('.hprt-roomtype-bed, [class*="bed-type"]');
                if (bedEl) {
                  var bedText = bedEl.textContent || '';
                  var bedLines = bedText.split('\\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
                  for (var b = 0; b < bedLines.length; b++) {
                    if (bedLines[b].match(/(bed|queen|king|twin|double|single|sofa)/i)) {
                      bedTypeMap[headerRoomTypeId] = bedLines[b];
                      break;
                    }
                  }
                }
              }
            }
            
            // Extract all room blocks with data-hotel-rounded-price attribute
            // Returns ALL rate options (room + meal plan + cancellation combinations)
            var dataRows = document.querySelectorAll('tr[data-block-id][data-hotel-rounded-price]');
            var seenBlockIds = {}; // Track exact block IDs to avoid true duplicates
            
            for (var i = 0; i < dataRows.length && roomOptions.length < 30; i++) {
              var row = dataRows[i];
              var blockId = row.getAttribute('data-block-id') || '';
              var parts = blockId.split('_');
              if (parts.length < 2) continue;
              
              // Skip exact duplicate block IDs
              if (seenBlockIds[blockId]) continue;
              seenBlockIds[blockId] = true;
              
              var roomTypeId = parts[0];
              
              // Get price from data attribute (more reliable than DOM text)
              var roundedPrice = row.getAttribute('data-hotel-rounded-price');
              var price = roundedPrice ? parseInt(roundedPrice, 10) : null;
              
              // Get price display from DOM
              var priceDisplay = '';
              var priceEl = row.querySelector('.bui-price-display__value');
              if (priceEl) {
                var displayMatch = (priceEl.textContent || '').match(/[\\$€£¥][\\d,]+/);
                priceDisplay = displayMatch ? displayMatch[0] : '';
              }
              
              // Get room name from our map
              var roomName = roomNameMap[roomTypeId] || '';
              
              // If no name in map, try to find it in the row
              if (!roomName) {
                var roomLink = row.querySelector('.hprt-roomtype-link, a[class*="room"]');
                roomName = roomLink ? (roomLink.textContent || '').trim() : '';
              }
              
              // Still no name? Use a generic one
              if (!roomName) {
                roomName = 'Room Type ' + roomTypeId;
              }
              
              // Parse data-fltrs for structured info (breakfast, beds)
              var fltrs = row.getAttribute('data-fltrs');
              var breakfastIncluded = false;
              var bedCount = [];
              
              if (fltrs) {
                try {
                  var fltrData = JSON.parse(fltrs.replace(/\\n/g, ''));
                  breakfastIncluded = fltrData.breakfast_included === 1;
                  bedCount = fltrData.bed_count || [];
                } catch (e) {}
              }
              
              // Get bed type from DOM (for display)
              var bedType = '';
              var bedEl = row.querySelector('.hprt-roomtype-bed, [class*="bed-type"]');
              if (bedEl) {
                var bedText = bedEl.textContent || '';
                var bedLines = bedText.split('\\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
                for (var k = 0; k < bedLines.length; k++) {
                  if (bedLines[k].match(/(bed|queen|king|twin|double|single|sofa)/i)) {
                    bedType = bedLines[k];
                    break;
                  }
                }
              }
              // Fallback 1: use bed type from our map (captured from header rows)
              if (!bedType && bedTypeMap[roomTypeId]) {
                bedType = bedTypeMap[roomTypeId];
              }
              // Fallback 2: use bed count from data-fltrs
              if (!bedType && bedCount.length > 0) {
                bedType = bedCount.length === 1 ? bedCount[0] + ' bed' : bedCount.join(' or ') + ' beds';
              }
              
              // Get cancellation policy from row text
              var rowText = row.textContent || '';
              var rowTextLower = rowText.toLowerCase();
              var cancellation = '';
              if (rowTextLower.indexOf('free cancellation') >= 0) {
                cancellation = 'Free cancellation';
              } else if (rowTextLower.indexOf('non-refundable') >= 0) {
                cancellation = 'Non-refundable';
              }
              
              // Get breakfast info (prefer data-fltrs, fallback to DOM text)
              var breakfast = '';
              if (breakfastIncluded) {
                breakfast = 'Breakfast included';
              } else if (rowTextLower.indexOf('breakfast included') >= 0) {
                breakfast = 'Breakfast included';
              } else if (rowTextLower.indexOf('room only') >= 0) {
                breakfast = 'Room only';
              }
              
              // Get occupancy
              var sleeps = null;
              var occupancyEl = row.querySelector('[class*="occupancy"], .hprt-occupancy-occupancy-info');
              if (occupancyEl) {
                var occMatch = (occupancyEl.textContent || '').match(/(\\d+)/);
                sleeps = occMatch ? parseInt(occMatch[1], 10) : null;
              }
              
              // Build features array
              var features = [];
              if (breakfast) features.push(breakfast);
              if (cancellation) features.push(cancellation);
              
              roomOptions.push({
                name: roomName,
                price: price,
                priceDisplay: priceDisplay,
                sleeps: sleeps,
                features: features,
                bedType: bedType,
                cancellation: cancellation,
                breakfast: breakfast,
                roomTypeId: roomTypeId
              });
            }
            
            // ============================================================
            // STRATEGY 2: Fallback to DOM scraping if data attributes failed
            // ============================================================
            if (roomOptions.length === 0) {
              var seenRooms = {};
              var roomTypeLinks = document.querySelectorAll('.hprt-roomtype-link, a[class*="hprt-roomtype"]');
              
              for (var i = 0; i < roomTypeLinks.length && roomOptions.length < 10; i++) {
                var roomLink = roomTypeLinks[i];
                var name = roomLink.textContent ? roomLink.textContent.trim() : '';
                
                if (!name || name.length < 3 || seenRooms[name]) continue;
                seenRooms[name] = true;
                
                var row = roomLink.closest('tr') || roomLink.closest('[data-block-id]') || roomLink.parentElement;
                var rowText = row ? row.textContent || '' : '';
                
                // Try to find price
                var price = null;
                var priceDisplay = '';
                var priceCell = row ? row.querySelector('.hprt-table-cell-price, [class*="price-block"], [class*="bui-price"]') : null;
                if (priceCell) {
                  var match = (priceCell.textContent || '').match(/[\\$€£¥]\\s*([\\d,]+)/);
                  if (match) {
                    price = parseInt(match[1].replace(/,/g, ''), 10);
                    priceDisplay = match[0];
                  }
                }
                
                // Bed type
                var bedType = '';
                var bedEl = row ? row.querySelector('.hprt-roomtype-bed, [class*="bed-type"]') : null;
                if (bedEl) {
                  var bedText = bedEl.textContent || '';
                  var bedLines = bedText.split('\\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
                  for (var k = 0; k < bedLines.length; k++) {
                    if (bedLines[k].match(/(bed|queen|king|twin|double|single|sofa)/i)) {
                      bedType = bedLines[k];
                      break;
                    }
                  }
                }
                
                // Cancellation and breakfast from text
                var rowTextLower = rowText.toLowerCase();
                var cancellation = '';
                if (rowTextLower.indexOf('free cancellation') >= 0) {
                  cancellation = 'Free cancellation';
                } else if (rowTextLower.indexOf('non-refundable') >= 0) {
                  cancellation = 'Non-refundable';
                }
                
                var breakfast = '';
                if (rowTextLower.indexOf('breakfast included') >= 0) {
                  breakfast = 'Breakfast included';
                } else if (rowTextLower.indexOf('room only') >= 0) {
                  breakfast = 'Room only';
                }
                
                // Occupancy
                var sleeps = null;
                var occupancyEl = row ? row.querySelector('[class*="occupancy"], .hprt-occupancy-occupancy-info') : null;
                if (occupancyEl) {
                  var occMatch = (occupancyEl.textContent || '').match(/(\\d+)/);
                  sleeps = occMatch ? parseInt(occMatch[1], 10) : null;
                }
                
                roomOptions.push({
                  name: name,
                  price: price,
                  priceDisplay: priceDisplay,
                  sleeps: sleeps,
                  features: [],
                  bedType: bedType,
                  cancellation: cancellation,
                  breakfast: breakfast
                });
              }
            }
            
            // ============================================================
            // STRATEGY 3: Last resort - look for any data-block-id elements
            // ============================================================
            if (roomOptions.length === 0) {
              var seenBlocks = {};
              var blocks = document.querySelectorAll('[data-block-id]');
              for (var i = 0; i < blocks.length && roomOptions.length < 10; i++) {
                var block = blocks[i];
                var blockId = block.getAttribute('data-block-id') || '';
                if (!blockId || blockId === 'header_survey') continue;
                
                var blockText = block.textContent || '';
                var nameEl = block.querySelector('a[class*="room"], span[class*="room-name"]');
                var name = nameEl ? (nameEl.textContent || '').trim() : '';
                
                if (!name) {
                  var lines = blockText.split('\\n').filter(function(l) { return l.trim().length > 0; });
                  name = lines[0] ? lines[0].trim().slice(0, 50) : '';
                }
                
                if (!name || name.length < 3 || seenBlocks[name]) continue;
                seenBlocks[name] = true;
                
                var priceMatch = blockText.match(/[\\$€£¥]\\s*([\\d,]+)/);
                var price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;
                
                roomOptions.push({
                  name: name,
                  price: price,
                  priceDisplay: priceMatch ? priceMatch[0] : '',
                  sleeps: null,
                  features: [],
                  bedType: '',
                  cancellation: '',
                  breakfast: ''
                });
              }
            }
            
            // Check for "no availability" message
            var bodyText = document.body.textContent || '';
            var noAvailability = 
              bodyText.indexOf('no availability') >= 0 ||
              bodyText.indexOf('sold out') >= 0 ||
              bodyText.indexOf('no rooms available') >= 0 ||
              bodyText.indexOf('fully booked') >= 0 ||
              bodyText.indexOf('We have no availability') >= 0;
            
            return {
              hotelName: hotelName,
              roomOptions: roomOptions,
              noAvailabilityDetected: noAvailability && roomOptions.length === 0
            };
          })()
        `) as { hotelName: string; roomOptions: RoomOption[]; noAvailabilityDetected: boolean };

        // Enrich room options with facilities from GraphQL API
        // This provides detailed amenities (AC, TV, bathroom, etc.) per room type
        if (result.roomOptions.length > 0) {
          try {
            const hotelId = await this.extractHotelId();
            if (hotelId) {
              const facilitiesMap = await this.fetchRoomFacilitiesGraphQL(hotelId, checkIn, checkOut);
              
              if (facilitiesMap.size > 0) {
                // Merge facilities into room options based on roomTypeId
                // Room type IDs are the first 9 digits of the full room ID (e.g., 652359501 -> 652359501)
                for (const room of result.roomOptions) {
                  if (room.roomTypeId) {
                    // Try exact match first
                    let facilities = facilitiesMap.get(room.roomTypeId);
                    
                    // If not found, the GraphQL returns full room IDs (e.g., 652359501)
                    // while our roomTypeId might be just the prefix
                    if (!facilities) {
                      // Find a matching key that starts with our roomTypeId
                      for (const [key, value] of facilitiesMap) {
                        if (key.startsWith(room.roomTypeId) || room.roomTypeId.startsWith(key)) {
                          facilities = value;
                          break;
                        }
                      }
                    }
                    
                    if (facilities) {
                      room.amenities = facilities;
                    }
                  }
                }
                
                logger.debug(
                  { enrichedRooms: result.roomOptions.filter(r => r.amenities).length },
                  'Enriched room options with GraphQL facilities'
                );
              }
            }
          } catch (error) {
            // Non-fatal: continue without facilities enrichment
            logger.debug({ error }, 'Failed to enrich rooms with GraphQL facilities');
          }
        }

        // Determine availability and lowest price
        const available = result.roomOptions.length > 0 && !result.noAvailabilityDetected;
        const prices = result.roomOptions
          .map(r => r.price)
          .filter((p): p is number => p !== null);
        const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;
        const lowestPriceRoom = result.roomOptions.find(r => r.price === lowestPrice);
        
        // Build message
        let message: string;
        if (!available) {
          message = "No rooms available for the selected dates.";
        } else if (result.roomOptions.length === 1) {
          message = `1 room type available${lowestPrice ? ` from ${lowestPriceRoom?.priceDisplay || '$' + lowestPrice}` : ''}.`;
        } else {
          message = `${result.roomOptions.length} room types available${lowestPrice ? ` from ${lowestPriceRoom?.priceDisplay || '$' + lowestPrice}` : ''}.`;
        }

        const availabilityResult = {
          available,
          hotelName: result.hotelName,
          checkIn,
          checkOut,
          guests,
          rooms,
          roomOptions: result.roomOptions,
          lowestPrice,
          lowestPriceDisplay: lowestPriceRoom?.priceDisplay || "",
          message,
          url: urlWithDates,
        };

        // Auto-save session after successful availability check
        await this.saveSession();

        return availabilityResult;
      },
      DEFAULT_RETRY_CONFIG,
      (attempt, error, delayMs) => {
        logger.warn(
          { attempt, error: error.message, retryInMs: delayMs },
          "Check availability attempt failed, retrying"
        );
      }
    );
  }

  /**
   * Get reviews for a specific hotel
   */
  async getReviews(
    hotelUrl: string,
    limit: number = 10,
    sortBy: "recent" | "highest" | "lowest" = "recent",
    filterBy?: "couples" | "families" | "solo" | "business" | "groups"
  ): Promise<ReviewsResult> {
    return retryWithBackoff(
      async () => {
        await this.enforceRateLimit();
        if (!this.page) throw new Error("Browser not initialized");
        
        // Navigate to hotel page
        const urlParts = hotelUrl.split("?")[0];
        const cleanUrl = urlParts?.split("#")[0] ?? hotelUrl;
        await this.page!.goto(cleanUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await this.page!.waitForTimeout(3000);
        
        // Close any popups
        try {
          const closeButtons = await this.page!.$$(
            '[aria-label="Dismiss sign-in info."], [data-testid="dismissButton"], button[aria-label*="close"], button[aria-label*="Close"]'
          );
          for (const btn of closeButtons) {
            try { await btn.click({ timeout: 1000 }); } catch {}
          }
        } catch {}
        await this.page!.keyboard.press("Escape");
        await this.page!.waitForTimeout(500);
        
        // Try API extraction first for basic review data
        // API provides: hotel name, overall rating, rating breakdown, and featured reviews
        // Note: API reviews are limited to what's in cache (~6-10 reviews), sorted by newest
        const apiData = await this.extractReviewsFromAPI();
        
        // Determine if we can use API data directly or need DOM fallback
        // Use API if: we have enough reviews AND no special sorting/filtering is requested
        const canUseApiOnly = apiData && 
          apiData.reviews.length >= limit && 
          sortBy === "recent" && 
          !filterBy;
        
        if (canUseApiOnly) {
          logger.debug("Using API extraction for reviews (sufficient data, no filters)");
          
          const reviewsResult = {
            hotelName: apiData.hotelName,
            overallRating: apiData.overallRating,
            totalReviews: apiData.totalReviews,
            ratingBreakdown: apiData.ratingBreakdown,
            reviews: apiData.reviews.slice(0, limit),
            url: cleanUrl,
          };

          await this.saveSession();
          return reviewsResult;
        }
        
        // Use API data for metadata if available, but get reviews from DOM
        // This gives us accurate rating breakdown from API + more reviews from DOM
        const baseData = apiData || {
          hotelName: '',
          overallRating: null as number | null,
          totalReviews: 0,
          ratingBreakdown: {
            staff: null as number | null,
            facilities: null as number | null,
            cleanliness: null as number | null,
            comfort: null as number | null,
            valueForMoney: null as number | null,
            location: null as number | null,
            freeWifi: null as number | null,
          },
        };
        
        // If API didn't give us hotel info, get it from DOM
        if (!baseData.hotelName) {
          const mainPageData = await this.page!.evaluate(`
            (function() {
              var results = { hotelName: '', overallRating: null, totalReviews: 0, breakdown: {} };
              
              // Hotel name
              var nameEl = document.querySelector('h2[class*="pp-header__title"], [data-testid="PropertyHeaderDesktop-wrapper"] h2, h2.d2fee87262');
              results.hotelName = nameEl?.textContent?.trim() || '';
              
              // Overall rating and total reviews from review-score-component
              var scoreComponent = document.querySelector('[data-testid="review-score-component"]');
              if (scoreComponent) {
                var text = scoreComponent.textContent || '';
                var scoreMatch = text.match(/Scored\\s+([\\d.]+)/);
                if (scoreMatch) {
                  results.overallRating = parseFloat(scoreMatch[1]);
                }
                var reviewCountMatch = text.match(/([\\d,]+)\\s+reviews?/);
                if (reviewCountMatch) {
                  results.totalReviews = parseInt(reviewCountMatch[1].replace(/,/g, ''));
                }
              }
              
              // Rating breakdown categories
              var breakdownEls = document.querySelectorAll('[data-testid="review-subscore"]');
              breakdownEls.forEach(function(el) {
                var text = el.textContent?.trim() || '';
                var parts = text.split(/\\s+/);
                if (parts.length >= 2) {
                  var score = parseFloat(parts[parts.length - 1]);
                  var category = parts.slice(0, -1).join(' ').toLowerCase();
                  if (category.includes('staff')) results.breakdown.staff = score;
                  else if (category.includes('facilities')) results.breakdown.facilities = score;
                  else if (category.includes('cleanliness')) results.breakdown.cleanliness = score;
                  else if (category.includes('comfort')) results.breakdown.comfort = score;
                  else if (category.includes('value') || category.includes('money')) results.breakdown.valueForMoney = score;
                  else if (category.includes('location')) results.breakdown.location = score;
                  else if (category.includes('wifi') || category.includes('wi-fi')) results.breakdown.freeWifi = score;
                }
              });
              
              return results;
            })()
          `) as { hotelName: string; overallRating: number | null; totalReviews: number; breakdown: Record<string, number> };
          
          baseData.hotelName = mainPageData.hotelName;
          if (baseData.overallRating === null) baseData.overallRating = mainPageData.overallRating;
          if (baseData.totalReviews === 0) baseData.totalReviews = mainPageData.totalReviews;
          
          // Fill in missing rating breakdown from DOM
          if (baseData.ratingBreakdown.staff === null) baseData.ratingBreakdown.staff = mainPageData.breakdown.staff ?? null;
          if (baseData.ratingBreakdown.facilities === null) baseData.ratingBreakdown.facilities = mainPageData.breakdown.facilities ?? null;
          if (baseData.ratingBreakdown.cleanliness === null) baseData.ratingBreakdown.cleanliness = mainPageData.breakdown.cleanliness ?? null;
          if (baseData.ratingBreakdown.comfort === null) baseData.ratingBreakdown.comfort = mainPageData.breakdown.comfort ?? null;
          if (baseData.ratingBreakdown.valueForMoney === null) baseData.ratingBreakdown.valueForMoney = mainPageData.breakdown.valueForMoney ?? null;
          if (baseData.ratingBreakdown.location === null) baseData.ratingBreakdown.location = mainPageData.breakdown.location ?? null;
          if (baseData.ratingBreakdown.freeWifi === null) baseData.ratingBreakdown.freeWifi = mainPageData.breakdown.freeWifi ?? null;
        }
        
        logger.debug("Using DOM extraction for reviews (need more reviews or filters)");
        
        // Click "Read all reviews" button to open reviews modal
        const readAllBtn = await this.page!.$('[data-testid="fr-read-all-reviews"], [data-testid="review-score-read-all"]');
        if (!readAllBtn) {
          throw new Error("Could not find 'Read all reviews' button. Hotel may not have reviews.");
        }
        await readAllBtn.click();
        await this.page!.waitForTimeout(3000);
        
        // Apply sort option if not default
        if (sortBy !== "recent") {
          try {
            const sorter = await this.page!.$('[data-testid="reviews-sorter-component"]');
            if (sorter) {
              await sorter.click();
              await this.page!.waitForTimeout(500);
              
              // Map our sortBy values to Booking.com's options
              const sortMap: Record<string, string> = {
                recent: "Newest first",
                highest: "Highest scores",
                lowest: "Lowest scores",
              };
              const sortOption = await this.page!.$(`[role="option"]:has-text("${sortMap[sortBy]}")`)
              if (sortOption) {
                await sortOption.click();
                await this.page!.waitForTimeout(2000);
              }
            }
          } catch {}
        }
        
        // Apply traveler type filter if specified
        if (filterBy) {
          try {
            const filterMap: Record<string, string> = {
              couples: "Couples",
              families: "Families",
              solo: "Solo travelers",
              business: "Business travelers",
              groups: "Groups of friends",
            };
            const filterLabel = await this.page!.$(`[data-testid="customerType"] label:has-text("${filterMap[filterBy]}")`)
            if (filterLabel) {
              await filterLabel.click();
              await this.page!.waitForTimeout(2000);
            }
          } catch {}
        }
        
        // Scroll down to ensure reviews are visible
        await this.page!.evaluate(`
          (function() {
            var reviewCards = document.querySelector('[data-testid="review-cards"]');
            if (reviewCards) {
              reviewCards.scrollIntoView({ behavior: 'instant', block: 'start' });
            }
          })()
        `);
        await this.page!.waitForTimeout(1000);
        
        // Scroll to load more reviews if needed (up to limit)
        const targetReviews = Math.min(limit, 50);
        let currentCount = 0;
        let scrollAttempts = 0;
        const maxScrollAttempts = Math.ceil(targetReviews / 10) + 3;
        
        while (scrollAttempts < maxScrollAttempts) {
          const count = await this.page!.evaluate(`
            document.querySelectorAll('[data-testid="review-card"]').length
          `) as number;
          
          if (count >= targetReviews || count === currentCount) {
            break;
          }
          currentCount = count;
          
          // Scroll within the modal/container
          await this.page!.evaluate(`
            (function() {
              var container = document.querySelector('[data-testid="review-list-container"]')
                || document.querySelector('[role="dialog"]');
              if (container) {
                container.scrollTop = container.scrollHeight;
              }
              // Also scroll the last review into view
              var reviews = document.querySelectorAll('[data-testid="review-card"]');
              if (reviews.length > 0) {
                reviews[reviews.length - 1].scrollIntoView({ behavior: 'instant', block: 'end' });
              }
            })()
          `);
          await this.page!.waitForTimeout(1500);
          scrollAttempts++;
        }
        
        // Extract reviews
        const reviews = await this.page!.evaluate(`
          (function() {
            var reviewCards = document.querySelectorAll('[data-testid="review-card"]');
            var reviews = [];
            
            for (var i = 0; i < reviewCards.length; i++) {
              var card = reviewCards[i];
              var review = {};
              
              // Title
              var titleEl = card.querySelector('[data-testid="review-title"]');
              review.title = titleEl?.textContent?.trim() || '';
              
              // Score - extract number from "Scored 10 10"
              var scoreEl = card.querySelector('[data-testid="review-score"]');
              var scoreText = scoreEl?.textContent?.trim() || '';
              var scoreMatch = scoreText.match(/Scored\\s+([\\d.]+)/);
              review.rating = scoreMatch ? parseFloat(scoreMatch[1]) : null;
              
              // Date - remove "Reviewed: " prefix
              var dateEl = card.querySelector('[data-testid="review-date"]');
              var dateText = dateEl?.textContent?.trim() || '';
              review.date = dateText.replace(/^Reviewed:\\s*/i, '');
              
              // Traveler type
              var typeEl = card.querySelector('[data-testid="review-traveler-type"]');
              review.travelerType = typeEl?.textContent?.trim() || '';
              
              // Stay date
              var stayDateEl = card.querySelector('[data-testid="review-stay-date"]');
              review.stayDate = stayDateEl?.textContent?.trim() || '';
              
              // Room name
              var roomEl = card.querySelector('[data-testid="review-room-name"]');
              review.roomType = roomEl?.textContent?.trim() || '';
              
              // Num nights
              var nightsEl = card.querySelector('[data-testid="review-num-nights"]');
              review.nightsStayed = nightsEl?.textContent?.trim()?.replace(/·/g, '').trim() || '';
              
              // Positive
              var positiveEl = card.querySelector('[data-testid="review-positive-text"]');
              review.positive = positiveEl?.textContent?.trim() || '';
              
              // Negative
              var negativeEl = card.querySelector('[data-testid="review-negative-text"]');
              review.negative = negativeEl?.textContent?.trim() || '';
              
              // Avatar/country - extract country from text like "JJohn United Kingdom"
              var avatarEl = card.querySelector('[data-testid="review-avatar"]');
              var avatarText = avatarEl?.textContent?.trim() || '';
              // Try to extract country (usually after the name, common patterns)
              var countryPatterns = [
                /(?:United Kingdom|United States|Ireland|France|Germany|Spain|Italy|Netherlands|Belgium|Switzerland|Australia|Canada|Sweden|Norway|Denmark|Japan|China|Brazil|Mexico|India|South Korea|Russia|Poland|Austria|Portugal|Greece|Turkey|Czech Republic|Hungary|Romania|Argentina|Chile|Colombia|Thailand|Singapore|Malaysia|Indonesia|Philippines|Vietnam|New Zealand|Finland|Israel|South Africa|Egypt|United Arab Emirates|Saudi Arabia)$/i
              ];
              review.country = '';
              for (var p = 0; p < countryPatterns.length; p++) {
                var match = avatarText.match(countryPatterns[p]);
                if (match) {
                  review.country = match[0];
                  break;
                }
              }
              // Fallback: take last two words if no country matched
              if (!review.country && avatarText) {
                var words = avatarText.split(/\\s+/);
                if (words.length >= 2) {
                  review.country = words.slice(-2).join(' ');
                } else if (words.length === 1) {
                  review.country = words[0];
                }
              }
              
              reviews.push(review);
            }
            
            return reviews;
          })()
        `) as Review[];
        
        // Build rating breakdown from baseData (populated from API or DOM)
        const ratingBreakdown: RatingBreakdown = {
          staff: baseData.ratingBreakdown.staff,
          facilities: baseData.ratingBreakdown.facilities,
          cleanliness: baseData.ratingBreakdown.cleanliness,
          comfort: baseData.ratingBreakdown.comfort,
          valueForMoney: baseData.ratingBreakdown.valueForMoney,
          location: baseData.ratingBreakdown.location,
          freeWifi: baseData.ratingBreakdown.freeWifi,
        };
        
        const reviewsResult = {
          hotelName: baseData.hotelName,
          overallRating: baseData.overallRating,
          totalReviews: baseData.totalReviews,
          ratingBreakdown,
          reviews: reviews.slice(0, limit),
          url: cleanUrl,
        };

        // Auto-save session after successful reviews fetch
        await this.saveSession();

        return reviewsResult;
      },
      DEFAULT_RETRY_CONFIG,
      (attempt, error, delayMs) => {
        logger.warn(
          { attempt, error: error.message, retryInMs: delayMs },
          "Get reviews attempt failed, retrying"
        );
      }
    );
  }

  /**
   * Get price calendar for a hotel - shows prices for multiple dates
   */
  async getPriceCalendar(
    hotelUrl: string,
    startDate: string,
    nights: number = 14,
    guests: number = 2,
    rooms: number = 1,
    currency: string = "USD"
  ): Promise<PriceCalendarResult> {
    // Validate inputs
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new Error("Invalid start date format. Use YYYY-MM-DD.");
    }
    
    // Limit to reasonable range
    const actualNights = Math.min(Math.max(nights, 1), 30);
    
    // Generate date range
    const dates: { checkIn: string; checkOut: string }[] = [];
    for (let i = 0; i < actualNights; i++) {
      const checkIn = new Date(start);
      checkIn.setDate(checkIn.getDate() + i);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 1);
      
      const checkInStr = checkIn.toISOString().split("T")[0];
      const checkOutStr = checkOut.toISOString().split("T")[0];
      if (checkInStr && checkOutStr) {
        dates.push({
          checkIn: checkInStr,
          checkOut: checkOutStr,
        });
      }
    }
    
    // Clean the hotel URL
    const urlParts = hotelUrl.split("?")[0];
    const cleanUrl = urlParts?.split("#")[0] ?? hotelUrl;
    
    // Collect prices for each date
    const prices: DatePrice[] = [];
    let hotelName = "";
    
    for (const dateRange of dates) {
      await this.enforceRateLimit();
      if (!this.page) throw new Error("Browser not initialized");
      
      const urlWithDates = `${cleanUrl}?checkin=${dateRange.checkIn}&checkout=${dateRange.checkOut}&group_adults=${guests}&no_rooms=${rooms}&selected_currency=${currency}`;
      
      try {
        await this.page.goto(urlWithDates, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await this.page.waitForTimeout(2000);
        
        // Close any popups
        try {
          await this.page.keyboard.press("Escape");
        } catch {}
        
        // Extract price data
        const priceData = await this.page.evaluate(`
          (function() {
            var result = { hotelName: '', price: null, priceDisplay: '', available: true, currency: '' };
            
            // Get hotel name (only need it once)
            var nameEl = document.querySelector('h2[class*="pp-header__title"], [data-testid="PropertyHeaderDesktop-wrapper"] h2, h2.d2fee87262');
            result.hotelName = nameEl?.textContent?.trim() || '';
            
            // Check for no availability message
            var noAvail = document.querySelector('[class*="soldout"], [class*="no-availability"], [data-testid="no-rooms-available"]');
            if (noAvail) {
              result.available = false;
              return result;
            }
            
            // Find the lowest price - look for price elements
            var priceElements = document.querySelectorAll('[data-testid="price-and-discounted-price"], .bui-price-display__value, .prco-valign-middle-helper');
            var prices = [];
            
            priceElements.forEach(function(el) {
              var text = el.textContent?.trim() || '';
              // Extract price number and currency
              var match = text.match(/([\\$€£¥₹])\\s*([\\d,]+)/);
              if (match) {
                var currencySymbol = match[1];
                var priceNum = parseInt(match[2].replace(/,/g, ''));
                if (!isNaN(priceNum) && priceNum > 0) {
                  prices.push({ price: priceNum, display: text.trim(), currency: currencySymbol });
                }
              }
              // Also try format like "241 $" or "241 USD"
              var match2 = text.match(/([\\d,]+)\\s*([\\$€£¥₹]|USD|EUR|GBP)/);
              if (match2) {
                var priceNum2 = parseInt(match2[1].replace(/,/g, ''));
                if (!isNaN(priceNum2) && priceNum2 > 0) {
                  prices.push({ price: priceNum2, display: text.trim(), currency: match2[2] });
                }
              }
            });
            
            // Get the lowest price
            if (prices.length > 0) {
              prices.sort(function(a, b) { return a.price - b.price; });
              result.price = prices[0].price;
              result.priceDisplay = prices[0].display;
              result.currency = prices[0].currency;
            } else {
              // Try alternative price selectors
              var altPrice = document.querySelector('[class*="bui-price-display"], [class*="price"]');
              if (altPrice) {
                var altText = altPrice.textContent?.trim() || '';
                var altMatch = altText.match(/([\\$€£¥₹])\\s*([\\d,]+)/);
                if (altMatch) {
                  result.price = parseInt(altMatch[2].replace(/,/g, ''));
                  result.priceDisplay = altMatch[0];
                  result.currency = altMatch[1];
                }
              }
            }
            
            // If still no price found, might be unavailable
            if (result.price === null) {
              result.available = false;
            }
            
            return result;
          })()
        `) as { hotelName: string; price: number | null; priceDisplay: string; available: boolean; currency: string };
        
        // Store hotel name from first result
        if (!hotelName && priceData.hotelName) {
          hotelName = priceData.hotelName;
        }
        
        // Map currency symbol to code
        const currencyMap: Record<string, string> = {
          "$": "USD",
          "€": "EUR",
          "£": "GBP",
          "¥": "JPY",
          "₹": "INR",
        };
        const currencyCode = currencyMap[priceData.currency] || priceData.currency || currency;
        
        prices.push({
          date: dateRange.checkIn,
          price: priceData.price,
          priceDisplay: priceData.priceDisplay || (priceData.price ? `${priceData.currency}${priceData.price}` : "N/A"),
          available: priceData.available,
          currency: currencyCode,
        });
        
      } catch (error) {
        // If page load fails, mark as unavailable
        prices.push({
          date: dateRange.checkIn,
          price: null,
          priceDisplay: "Error",
          available: false,
          currency,
        });
      }
    }
    
    // Calculate statistics
    const availablePrices = prices.filter(p => p.price !== null && p.available);
    const priceValues = availablePrices.map(p => p.price as number);
    
    let lowestPrice: number | null = null;
    let lowestPriceDate: string | null = null;
    let highestPrice: number | null = null;
    let highestPriceDate: string | null = null;
    let averagePrice: number | null = null;
    
    if (priceValues.length > 0) {
      lowestPrice = Math.min(...priceValues);
      highestPrice = Math.max(...priceValues);
      averagePrice = Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length);
      
      const lowestPriceEntry = availablePrices.find(p => p.price === lowestPrice);
      const highestPriceEntry = availablePrices.find(p => p.price === highestPrice);
      
      lowestPriceDate = lowestPriceEntry?.date || null;
      highestPriceDate = highestPriceEntry?.date || null;
    }
    
    // Calculate end date
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + actualNights - 1);
    const endDateStr = endDate.toISOString().split("T")[0] ?? startDate;
    
    const priceCalendarResult = {
      hotelName,
      startDate,
      endDate: endDateStr,
      nights: actualNights,
      currency,
      prices,
      lowestPrice,
      lowestPriceDate,
      highestPrice,
      highestPriceDate,
      averagePrice,
      url: cleanUrl,
    };

    // Auto-save session after successful price calendar fetch
    await this.saveSession();

    return priceCalendarResult;
  }
}
