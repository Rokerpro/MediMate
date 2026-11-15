import { z } from "zod";

/** GET /api/auth/me (docs/API_CONTRACTS.md §0a). `user` is null when signed out. */
export const currentUserSchema = z.strictObject({
  email: z.string().max(320).nullable(),
  displayName: z.string().min(1).max(100),
});

export const currentUserResponseSchema = z.strictObject({
  user: currentUserSchema.nullable(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
