import { z } from "zod";

const TrackingToken = z.string().trim().min(1).max(40).regex(/^[a-z0-9]+$/);

export const ContentExperimentInputSchema = z.object({
  productItemId: z.string().trim().min(1).max(100),
  productName: z.string().trim().min(3).max(500),
  platform: z.enum(["tiktok", "youtube"]),
  channel: TrackingToken,
  contentKey: TrackingToken,
  variant: TrackingToken,
  campaign: TrackingToken,
  audience: z.string().trim().min(3).max(500),
  painPoint: z.string().trim().min(3).max(1_000),
  hook: z.string().trim().min(3).max(1_000),
  proof: z.string().trim().min(3).max(1_500),
  cta: z.string().trim().min(2).max(500),
  budget: z.number().finite().min(0).max(1_000_000_000),
});

export type ContentExperimentInput = z.infer<typeof ContentExperimentInputSchema>;
