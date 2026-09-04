import { SetMetadata } from "@nestjs/common";

export const PUBLIC_KEY = "IS_PUBLIC";

/**
 * Mark an endpoint as public (no authentication required).
 * Use on routes that don't require an access token.
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
