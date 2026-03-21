import { z } from 'zod';

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(32, 'Username must not exceed 32 characters')
    .regex(/^[a-zA-Z0-9_.]+$/, 'Username can only contain letters, numbers, dots, and underscores')
    .optional(),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(32, 'Display name must not exceed 32 characters')
    .optional(),
  avatar: z.union([z.string().url(), z.literal('')]).optional(),
  banner: z.union([z.string().url(), z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal('')]).optional(),
  activityStatus: z
    .string()
    .max(128, 'Activity status must not exceed 128 characters')
    .optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
