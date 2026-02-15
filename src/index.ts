#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { HotelBrowser, HotelSearchParams, HotelFilters, HotelResult, HotelSearchError, ErrorCodes } from "./browser.js";

// Property type enum
const PropertyTypeEnum = z.enum([
  "hotel", "apartment", "resort", "villa", "vacation_home", "hostel", "bnb",
  "guesthouse", "homestay", "motel", "inn", "lodge", "chalet", "campground",
  "glamping", "boat", "capsule", "ryokan", "riad", "country_house", "farm_stay"
]);

// Bed type enum
const BedTypeEnum = z.enum(["king", "queen", "double", "twin", "single"]);

// Distance enum
const DistanceEnum = z.enum(["half_mile", "1_mile", "2_miles"]);

// Hotel chain enum
const HotelChainEnum = z.enum([
  "marriott", "hilton", "hyatt", "ihg", "wyndham", "best_western", "accor",
  "choice", "radisson", "ritz_carlton", "four_seasons", "fairmont", "sheraton",
  "westin", "w_hotels", "courtyard", "residence_inn", "hampton", "embassy_suites",
  "doubletree"
]);

// Basic search schema
const SearchHotelsSchema = z.object({
  destination: z.string().describe("City or location (e.g., 'San Juan, Puerto Rico')"),
  checkIn: z.string().describe("Check-in date (YYYY-MM-DD)"),
  checkOut: z.string().describe("Check-out date (YYYY-MM-DD)"),
  guests: z.number().default(2).describe("Number of guests"),
  rooms: z.number().default(1).describe("Number of rooms"),
});

// Comprehensive find_hotels schema with all filters
const FindHotelsSchema = z.object({
  // Basic search params
  destination: z.string().describe("City or location (e.g., 'San Juan, Puerto Rico')"),
  checkIn: z.string().describe("Check-in date (YYYY-MM-DD)"),
  checkOut: z.string().describe("Check-out date (YYYY-MM-DD)"),
  guests: z.number().default(2).describe("Number of guests"),
  rooms: z.number().default(1).describe("Number of rooms"),
  
  // Currency & Sorting
  currency: z.string().optional().describe("Currency code (USD, EUR, GBP, JPY, etc.)"),
  sortBy: z.enum(["popularity", "price_lowest", "price_highest", "rating", "distance"]).optional().describe("Sort results by"),
  
  // Pagination
  limit: z.number().min(1).max(100).optional().describe("Maximum number of results to return (default: 25, max: 100)"),
  
  // Rating & Price
  minRating: z.number().optional().describe("Minimum rating (6=Pleasant, 7=Good, 8=Very Good, 9=Wonderful)"),
  minPrice: z.number().optional().describe("Minimum price per night"),
  maxPrice: z.number().optional().describe("Maximum price per night"),
  
  // Property & Star Rating
  propertyType: PropertyTypeEnum.optional().describe("Type of property (hotel, resort, apartment, villa, etc.)"),
  starRating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional().describe("Star rating (1-5)"),
  
  // Beach & Location
  beachfront: z.boolean().optional().describe("Beachfront property"),
  beachAccess: z.boolean().optional().describe("Has beach access"),
  oceanView: z.boolean().optional().describe("Room with ocean/sea view"),
  maxDistanceFromCenter: DistanceEnum.optional().describe("Maximum distance from center"),
  
  // Hotel Facilities
  freeWifi: z.boolean().optional().describe("Free WiFi"),
  pool: z.boolean().optional().describe("Swimming pool"),
  spa: z.boolean().optional().describe("Spa/wellness center"),
  fitness: z.boolean().optional().describe("Fitness center/gym"),
  parking: z.boolean().optional().describe("Parking available"),
  restaurant: z.boolean().optional().describe("On-site restaurant"),
  bar: z.boolean().optional().describe("On-site bar"),
  roomService: z.boolean().optional().describe("24-hour room service"),
  airportShuttle: z.boolean().optional().describe("Airport shuttle"),
  hotTub: z.boolean().optional().describe("Hot tub/Jacuzzi"),
  sauna: z.boolean().optional().describe("Sauna"),
  garden: z.boolean().optional().describe("Garden"),
  terrace: z.boolean().optional().describe("Terrace"),
  nonSmokingRooms: z.boolean().optional().describe("Non-smoking rooms"),
  familyRooms: z.boolean().optional().describe("Family rooms"),
  evCharging: z.boolean().optional().describe("Electric vehicle charging"),
  casino: z.boolean().optional().describe("Casino"),
  golf: z.boolean().optional().describe("Golf course nearby"),
  tennis: z.boolean().optional().describe("Tennis court"),
  businessCenter: z.boolean().optional().describe("Business center"),
  
  // Room Facilities
  airConditioning: z.boolean().optional().describe("Air conditioning"),
  kitchen: z.boolean().optional().describe("Kitchen/kitchenette"),
  balcony: z.boolean().optional().describe("Balcony"),
  privatePool: z.boolean().optional().describe("Private pool"),
  privateBathroom: z.boolean().optional().describe("Private bathroom"),
  bath: z.boolean().optional().describe("Bathtub"),
  tv: z.boolean().optional().describe("TV"),
  minibar: z.boolean().optional().describe("Minibar"),
  safe: z.boolean().optional().describe("In-room safe"),
  washingMachine: z.boolean().optional().describe("Washing machine"),
  soundproofing: z.boolean().optional().describe("Soundproofing"),
  
  // Bed Type
  bedType: BedTypeEnum.optional().describe("Preferred bed type"),
  
  // Meal Plans
  breakfast: z.boolean().optional().describe("Breakfast included"),
  allInclusive: z.boolean().optional().describe("All-inclusive"),
  selfCatering: z.boolean().optional().describe("Self-catering/kitchen amenities"),
  
  // Stay Type
  petFriendly: z.boolean().optional().describe("Pet friendly"),
  adultsOnly: z.boolean().optional().describe("Adults only"),
  lgbtqFriendly: z.boolean().optional().describe("LGBTQ+ friendly (Travel Proud)"),
  
  // Booking Policies
  freeCancellation: z.boolean().optional().describe("Free cancellation"),
  noPrepayment: z.boolean().optional().describe("No prepayment needed"),
  
  // Sustainability
  sustainabilityCertified: z.boolean().optional().describe("Sustainability certification"),
  
  // Activities
  snorkeling: z.boolean().optional().describe("Snorkeling"),
  diving: z.boolean().optional().describe("Diving"),
  fishing: z.boolean().optional().describe("Fishing"),
  hiking: z.boolean().optional().describe("Hiking"),
  cycling: z.boolean().optional().describe("Cycling"),
  skiing: z.boolean().optional().describe("Skiing"),
  waterSports: z.boolean().optional().describe("Water sports"),
  
  // Accessibility
  wheelchairAccessible: z.boolean().optional().describe("Wheelchair accessible"),
  groundFloor: z.boolean().optional().describe("Ground floor unit"),
  elevatorAccess: z.boolean().optional().describe("Elevator access"),
  walkInShower: z.boolean().optional().describe("Walk-in shower"),
  rollInShower: z.boolean().optional().describe("Roll-in shower"),
  grabRails: z.boolean().optional().describe("Grab rails"),
  
  // Hotel Chain
  hotelChain: HotelChainEnum.optional().describe("Specific hotel chain"),
});

const HotelDetailsSchema = z.object({
  url: z.string().describe("Booking.com URL for the hotel"),
});

// Global browser instance (reuse for efficiency)
let browser: HotelBrowser | null = null;

async function getBrowser(): Promise<HotelBrowser> {
  if (!browser) {
    browser = new HotelBrowser();
    await browser.init(true);
  }
  return browser;
}

function formatHotelResult(hotel: HotelResult, index: number): string {
  const lines: string[] = [];
  
  lines.push(`${index + 1}. ${hotel.name}`);
  lines.push(`   Price: ${hotel.priceDisplay}`);
  
  if (hotel.rating) {
    lines.push(`   Rating: ${hotel.rating}/10 ${hotel.ratingText} (${hotel.reviewCount || "?"} reviews)`);
  }
  
  if (hotel.distanceToCenter) {
    lines.push(`   Location: ${hotel.distanceToCenter}`);
  }
  
  if (hotel.availability) {
    lines.push(`   Availability: ${hotel.availability}`);
  }
  
  if (hotel.amenities.length > 0) {
    lines.push(`   Amenities: ${hotel.amenities.join(", ")}`);
  }
  
  if (hotel.matchScore !== undefined && hotel.matchScore > 0) {
    lines.push(`   Match Score: ${hotel.matchScore}`);
    if (hotel.matchReasons && hotel.matchReasons.length > 0) {
      lines.push(`   Why it matches: ${hotel.matchReasons.join(", ")}`);
    }
  }
  
  if (hotel.thumbnailUrl) {
    lines.push(`   Image: ${hotel.thumbnailUrl}`);
  }
  
  if (hotel.link) {
    // Shorten link for readability
    const shortLink = hotel.link.split("?")[0];
    lines.push(`   Book: ${shortLink}`);
  }
  
  return lines.join("\n");
}

// Create MCP server
const server = new Server(
  {
    name: "hotelzero",
    version: "1.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Build comprehensive input schema for find_hotels
const findHotelsInputSchema = {
  type: "object",
  properties: {
    // Basic search
    destination: { type: "string", description: "City or location (e.g., 'San Juan, Puerto Rico')" },
    checkIn: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
    checkOut: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
    guests: { type: "number", description: "Number of guests", default: 2 },
    rooms: { type: "number", description: "Number of rooms", default: 1 },
    
    // Rating & Price
    minRating: { type: "number", description: "Minimum rating: 6=Pleasant, 7=Good, 8=Very Good, 9=Wonderful" },
    minPrice: { type: "number", description: "Minimum price per night" },
    maxPrice: { type: "number", description: "Maximum price per night" },
    
    // Currency & Sorting
    currency: { type: "string", description: "Currency code (USD, EUR, GBP, JPY, etc.)", default: "USD" },
    sortBy: { 
      type: "string", 
      description: "Sort results by",
      enum: ["popularity", "price_lowest", "price_highest", "rating", "distance"]
    },
    
    // Pagination
    limit: { type: "number", description: "Maximum results to return (default: 25, max: 100)", default: 25 },
    
    // Property Type
    propertyType: { 
      type: "string", 
      description: "Property type",
      enum: ["hotel", "apartment", "resort", "villa", "vacation_home", "hostel", "bnb", "guesthouse", "homestay", "motel", "inn", "lodge", "chalet", "campground", "glamping", "boat", "capsule", "ryokan", "riad", "country_house", "farm_stay"]
    },
    starRating: { type: "number", description: "Star rating (1-5)", enum: [1, 2, 3, 4, 5] },
    
    // Beach & Location
    beachfront: { type: "boolean", description: "Beachfront property" },
    beachAccess: { type: "boolean", description: "Has beach access" },
    oceanView: { type: "boolean", description: "Room with ocean/sea view" },
    maxDistanceFromCenter: { type: "string", description: "Max distance from center", enum: ["half_mile", "1_mile", "2_miles"] },
    
    // Hotel Facilities
    freeWifi: { type: "boolean", description: "Free WiFi" },
    pool: { type: "boolean", description: "Swimming pool" },
    spa: { type: "boolean", description: "Spa/wellness" },
    fitness: { type: "boolean", description: "Fitness center/gym" },
    parking: { type: "boolean", description: "Parking" },
    restaurant: { type: "boolean", description: "Restaurant" },
    bar: { type: "boolean", description: "Bar" },
    roomService: { type: "boolean", description: "24-hour room service" },
    airportShuttle: { type: "boolean", description: "Airport shuttle" },
    hotTub: { type: "boolean", description: "Hot tub/Jacuzzi" },
    sauna: { type: "boolean", description: "Sauna" },
    garden: { type: "boolean", description: "Garden" },
    terrace: { type: "boolean", description: "Terrace" },
    nonSmokingRooms: { type: "boolean", description: "Non-smoking rooms" },
    familyRooms: { type: "boolean", description: "Family rooms" },
    evCharging: { type: "boolean", description: "EV charging" },
    casino: { type: "boolean", description: "Casino" },
    golf: { type: "boolean", description: "Golf nearby" },
    tennis: { type: "boolean", description: "Tennis" },
    businessCenter: { type: "boolean", description: "Business center" },
    bbqFacilities: { type: "boolean", description: "BBQ facilities" },
    laundry: { type: "boolean", description: "Laundry service" },
    concierge: { type: "boolean", description: "Concierge" },
    
    // Room Facilities
    airConditioning: { type: "boolean", description: "Air conditioning" },
    kitchen: { type: "boolean", description: "Kitchen/kitchenette" },
    balcony: { type: "boolean", description: "Balcony" },
    privatePool: { type: "boolean", description: "Private pool" },
    privateBathroom: { type: "boolean", description: "Private bathroom" },
    bath: { type: "boolean", description: "Bathtub" },
    tv: { type: "boolean", description: "TV" },
    minibar: { type: "boolean", description: "Minibar" },
    safe: { type: "boolean", description: "In-room safe" },
    washingMachine: { type: "boolean", description: "Washing machine" },
    soundproofing: { type: "boolean", description: "Soundproofing" },
    
    // Bed Type
    bedType: { type: "string", description: "Bed type", enum: ["king", "queen", "double", "twin", "single"] },
    
    // Meal Plans
    breakfast: { type: "boolean", description: "Breakfast included" },
    allInclusive: { type: "boolean", description: "All-inclusive" },
    selfCatering: { type: "boolean", description: "Self-catering" },
    
    // Stay Type
    petFriendly: { type: "boolean", description: "Pet friendly" },
    adultsOnly: { type: "boolean", description: "Adults only" },
    lgbtqFriendly: { type: "boolean", description: "LGBTQ+ friendly" },
    
    // Booking Policies
    freeCancellation: { type: "boolean", description: "Free cancellation" },
    noPrepayment: { type: "boolean", description: "No prepayment" },
    noBookingFee: { type: "boolean", description: "No booking fee" },
    
    // Sustainability
    sustainabilityCertified: { type: "boolean", description: "Sustainability certified" },
    
    // Activities
    snorkeling: { type: "boolean", description: "Snorkeling" },
    diving: { type: "boolean", description: "Diving" },
    fishing: { type: "boolean", description: "Fishing" },
    hiking: { type: "boolean", description: "Hiking" },
    cycling: { type: "boolean", description: "Cycling" },
    skiing: { type: "boolean", description: "Skiing" },
    waterSports: { type: "boolean", description: "Water sports" },
    horseRiding: { type: "boolean", description: "Horse riding" },
    
    // Accessibility
    wheelchairAccessible: { type: "boolean", description: "Wheelchair accessible" },
    groundFloor: { type: "boolean", description: "Ground floor" },
    elevatorAccess: { type: "boolean", description: "Elevator access" },
    walkInShower: { type: "boolean", description: "Walk-in shower" },
    rollInShower: { type: "boolean", description: "Roll-in shower" },
    showerChair: { type: "boolean", description: "Shower chair" },
    grabRails: { type: "boolean", description: "Grab rails" },
    raisedToilet: { type: "boolean", description: "Raised toilet" },
    loweredSink: { type: "boolean", description: "Lowered sink" },
    braille: { type: "boolean", description: "Braille signage" },
    tactileSigns: { type: "boolean", description: "Tactile signs" },
    auditoryGuidance: { type: "boolean", description: "Auditory guidance" },
    
    // Hotel Chain
    hotelChain: { 
      type: "string", 
      description: "Hotel chain",
      enum: ["marriott", "hilton", "hyatt", "ihg", "wyndham", "best_western", "accor", "choice", "radisson", "ritz_carlton", "four_seasons", "fairmont", "sheraton", "westin", "w_hotels", "courtyard", "residence_inn", "hampton", "embassy_suites", "doubletree"]
    },
  },
  required: ["destination", "checkIn", "checkOut"],
};

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "find_hotels",
        description: `Search for hotels with comprehensive filtering options. Supports 80+ filters including:
- Property types (hotel, resort, villa, apartment, hostel, B&B, glamping, ryokan, etc.)
- Star ratings (1-5 stars)
- Beach/location (beachfront, ocean view, distance from center)
- Amenities (pool, spa, gym, WiFi, parking, restaurant, bar, hot tub, casino, golf, tennis)
- Room features (A/C, kitchen, balcony, private pool, bathtub, minibar, safe)
- Bed types (king, queen, double, twin, single)
- Meal plans (breakfast, all-inclusive, self-catering)
- Policies (pet-friendly, adults-only, LGBTQ+ friendly, free cancellation)
- Activities (snorkeling, diving, fishing, hiking, skiing, water sports)
- Accessibility (wheelchair, elevator, walk-in shower, grab rails, braille)
- Hotel chains (Marriott, Hilton, Hyatt, IHG, Ritz-Carlton, Four Seasons, etc.)
Results are scored and ranked by how well they match the criteria.`,
        inputSchema: findHotelsInputSchema,
      },
      {
        name: "search_hotels",
        description: "Basic hotel search without filters. Use find_hotels for filtered searches.",
        inputSchema: {
          type: "object",
          properties: {
            destination: { type: "string", description: "City or location" },
            checkIn: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
            checkOut: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
            guests: { type: "number", description: "Number of guests", default: 2 },
            rooms: { type: "number", description: "Number of rooms", default: 1 },
          },
          required: ["destination", "checkIn", "checkOut"],
        },
      },
      {
        name: "get_hotel_details",
        description: "Get detailed information about a specific hotel including full amenity list, description, and photos",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "Booking.com URL for the hotel" },
          },
          required: ["url"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const b = await getBrowser();

    switch (name) {
      case "find_hotels": {
        const parsed = FindHotelsSchema.parse(args);
        
        const searchParams: HotelSearchParams = {
          destination: parsed.destination,
          checkIn: parsed.checkIn,
          checkOut: parsed.checkOut,
          guests: parsed.guests,
          rooms: parsed.rooms,
          currency: parsed.currency,
          sortBy: parsed.sortBy,
          limit: parsed.limit,
        };

        // Build filters object from all parsed parameters
        const filters: HotelFilters = {};
        
        // Copy all filter properties (exclude search params)
        const filterKeys = Object.keys(parsed).filter(k => 
          !['destination', 'checkIn', 'checkOut', 'guests', 'rooms', 'currency', 'sortBy', 'limit'].includes(k)
        );
        
        for (const key of filterKeys) {
          const value = (parsed as Record<string, unknown>)[key];
          if (value !== undefined && value !== null) {
            (filters as Record<string, unknown>)[key] = value;
          }
        }

        const results = await b.searchHotels(searchParams, filters);
        
        // Format results nicely
        const header = `Found ${results.length} hotels in ${parsed.destination} matching your criteria:\n`;
        
        // Build active filters display
        const activeFilters: string[] = [];
        if (parsed.beachfront) activeFilters.push("beachfront");
        if (parsed.beachAccess) activeFilters.push("beach access");
        if (parsed.oceanView) activeFilters.push("ocean view");
        if (parsed.freeWifi) activeFilters.push("wifi");
        if (parsed.pool) activeFilters.push("pool");
        if (parsed.spa) activeFilters.push("spa");
        if (parsed.fitness) activeFilters.push("gym");
        if (parsed.breakfast) activeFilters.push("breakfast");
        if (parsed.parking) activeFilters.push("parking");
        if (parsed.hotTub) activeFilters.push("hot tub");
        if (parsed.kitchen) activeFilters.push("kitchen");
        if (parsed.balcony) activeFilters.push("balcony");
        if (parsed.petFriendly) activeFilters.push("pet-friendly");
        if (parsed.adultsOnly) activeFilters.push("adults-only");
        if (parsed.freeCancellation) activeFilters.push("free cancellation");
        if (parsed.wheelchairAccessible) activeFilters.push("wheelchair accessible");
        if (parsed.propertyType) activeFilters.push(parsed.propertyType);
        if (parsed.starRating) activeFilters.push(`${parsed.starRating}-star`);
        if (parsed.hotelChain) activeFilters.push(parsed.hotelChain);
        if (parsed.minRating) activeFilters.push(`rating ≥${parsed.minRating}`);
        if (parsed.minPrice) activeFilters.push(`≥$${parsed.minPrice}/night`);
        if (parsed.maxPrice) activeFilters.push(`≤$${parsed.maxPrice}/night`);
        if (parsed.allInclusive) activeFilters.push("all-inclusive");
        if (parsed.snorkeling) activeFilters.push("snorkeling");
        if (parsed.diving) activeFilters.push("diving");
        if (parsed.skiing) activeFilters.push("skiing");
        if (parsed.currency && parsed.currency !== "USD") activeFilters.push(`currency: ${parsed.currency}`);
        if (parsed.sortBy) activeFilters.push(`sorted by: ${parsed.sortBy.replace("_", " ")}`);
        
        const filtersLine = activeFilters.length > 0 
          ? `Filters: ${activeFilters.join(", ")}\n\n` 
          : "\n";
        
        const hotelList = results
          .map((h, i) => formatHotelResult(h, i))
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: header + filtersLine + hotelList,
            },
          ],
        };
      }

      case "search_hotels": {
        const parsed = SearchHotelsSchema.parse(args);
        
        const results = await b.searchHotels({
          destination: parsed.destination,
          checkIn: parsed.checkIn,
          checkOut: parsed.checkOut,
          guests: parsed.guests,
          rooms: parsed.rooms,
        });

        const header = `Found ${results.length} hotels in ${parsed.destination}:\n\n`;
        const hotelList = results
          .slice(0, 15)
          .map((h, i) => formatHotelResult(h, i))
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: header + hotelList,
            },
          ],
        };
      }

      case "get_hotel_details": {
        const parsed = HotelDetailsSchema.parse(args);
        const details = await b.getHotelDetails(parsed.url);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(details, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Handle custom HotelSearchError with structured error info
    if (error instanceof HotelSearchError) {
      let helpText = "";
      
      switch (error.code) {
        case ErrorCodes.CAPTCHA_DETECTED:
          helpText = "\n\nTip: Wait 5-10 minutes before trying again.";
          break;
        case ErrorCodes.RATE_LIMITED:
        case ErrorCodes.BLOCKED:
          helpText = "\n\nTip: The server is rate-limiting requests. Wait a few minutes before trying again.";
          break;
        case ErrorCodes.DESTINATION_NOT_FOUND:
          helpText = "\n\nTip: Check the destination spelling. Try a more specific location like 'Paris, France' instead of just 'Paris'.";
          break;
        case ErrorCodes.TIMEOUT:
          helpText = "\n\nTip: The request timed out. This may be due to slow network or server issues. Try again.";
          break;
        case ErrorCodes.NETWORK_ERROR:
          helpText = "\n\nTip: Check your internet connection and try again.";
          break;
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Error [${error.code}]: ${error.message}${helpText}`,
          },
        ],
        isError: true,
      };
    }
    
    // Handle generic errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Cleanup on exit
async function cleanup() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HotelZero v1.3.0 running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
