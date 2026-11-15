// Single source of truth for API request/response shapes (docs/API_CONTRACTS.md §5).
// Frontend and backend both import from here; types are inferred from the Zod schemas.
export * from "./api-error";
export * from "./profile";
export * from "./health-log";
export * from "./assistant";
export * from "./reminder";
export * from "./prescription";
export * from "./assessment-history";
export * from "./auth";
export * from "./weekly-summary";
export * from "./analytics";
export * from "./notifications";
