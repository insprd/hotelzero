import { chromium, Browser, Page } from "playwright";

export interface HotelSearchParams {
  destination: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guests: number;
  rooms: number;
}

// Comprehensive filter interface based on all Booking.com filter codes
export interface HotelFilters {
  // === Rating & Reviews ===
  minRating?: number; // 6, 7, 8, or 9 (Pleasant, Good, Very Good, Wonderful)
  
  // === Price ===
  maxPrice?: number; // Client-side filter
  
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
  matchScore?: number;
  matchReasons?: string[];
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
  private page: Page | null = null;

  async init(headless: boolean = true): Promise<void> {
    this.browser = await chromium.launch({
      headless,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });
    this.page = await context.newPage();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  private buildBookingUrl(params: HotelSearchParams, filters?: HotelFilters): string {
    const { destination, checkIn, checkOut, guests, rooms } = params;
    
    const url = new URL("https://www.booking.com/searchresults.html");
    url.searchParams.set("ss", destination);
    url.searchParams.set("checkin", checkIn);
    url.searchParams.set("checkout", checkOut);
    url.searchParams.set("group_adults", guests.toString());
    url.searchParams.set("no_rooms", rooms.toString());
    url.searchParams.set("selected_currency", "USD");
    
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

  async searchHotels(
    params: HotelSearchParams,
    filters?: HotelFilters
  ): Promise<HotelResult[]> {
    if (!this.page) throw new Error("Browser not initialized");

    const url = this.buildBookingUrl(params, filters);
    
    await this.page.goto(url, { waitUntil: "networkidle" });
    await this.page.waitForTimeout(2000);

    // Close any popups/modals
    await this.dismissPopups();

    // Scroll to load more results
    await this.scrollToLoadMore();

    // Extract detailed hotel info
    const hotels = await this.extractHotelDetails();

    // Apply client-side filtering and scoring if we have preferences
    if (filters) {
      return this.scoreAndFilterHotels(hotels, filters);
    }

    return hotels;
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

  private async scrollToLoadMore(): Promise<void> {
    if (!this.page) return;

    // Scroll down a few times to load more results
    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await this.page.waitForTimeout(1000);
    }

    // Scroll back to top
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
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
        if (allPriceEls.length > 0) {
          priceText = allPriceEls[0].textContent?.trim() || "";
          const priceMatch = priceText.match(/\$?([\d,]+)/);
          price = priceMatch ? parseInt(priceMatch[1].replace(",", "")) : null;
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
        const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(",", "")) : null;

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
        });
      });

      return results;
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
        if (filters.maxPrice && hotel.price && hotel.price > filters.maxPrice) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }

  async getHotelDetails(hotelUrl: string): Promise<Record<string, unknown>> {
    if (!this.page) throw new Error("Browser not initialized");

    await this.page.goto(hotelUrl, { waitUntil: "networkidle" });
    await this.page.waitForTimeout(2000);
    await this.dismissPopups();

    // Extract detailed information from hotel page
    return await this.page.evaluate(() => {
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
  }

  async takeScreenshot(path: string): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");
    await this.page.screenshot({ path, fullPage: false });
  }

  async getPageContent(): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized");
    return await this.page.content();
  }
}
