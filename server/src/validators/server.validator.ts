import { z } from 'zod';

export const createServerSchema = z.object({
  name: z
    .string()
    .min(1, 'Server name is required')
    .max(100, 'Server name must not exceed 100 characters'),
  templateId: z.string().optional(),
});

export const updateServerSchema = z.object({
  name: z
    .string()
    .min(1, 'Server name is required')
    .max(100, 'Server name must not exceed 100 characters')
    .optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  banner: z.string().optional(),
});

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must not exceed 100 characters'),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must not exceed 100 characters'),
});

export const createChannelSchema = z.object({
  name: z
    .string()
    .min(1, 'Channel name is required')
    .max(100, 'Channel name must not exceed 100 characters'),
  type: z.enum(['text', 'voice']).default('text'),
  categoryId: z.string().optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  topic: z.string().max(1024).optional(),
});

const attachmentSchema = z.object({
  url: z.string(),
  type: z.enum(['image', 'video', 'file']),
  name: z.string(),
  size: z.number(),
});

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(2000, 'Message must not exceed 2000 characters'),
  replyTo: z.string().optional(),
  attachments: z.array(attachmentSchema).max(5).optional(),
});

export const editMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(2000, 'Message must not exceed 2000 characters'),
});
