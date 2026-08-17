import { z } from "zod";

const HttpsUrl = z.string().trim().url().max(2_000).refine(value => value.startsWith("https://"), "Chỉ chấp nhận URL https.");

export const VideoGeneratorSchema = z.enum(["TOPVIEW_API", "TOPVIEW_WEB_MANUAL", "OTHER_MANUAL"]);

/** Luồng miễn phí: người dùng tự tạo video trên web TopView rồi nạp kết quả vào ProfitOS. */
export const ManualVideoIngestSchema = z.object({
  productItemId: z.string().trim().min(1).max(100),
  productName: z.string().trim().min(3).max(500),
  generator: z.enum(["TOPVIEW_WEB_MANUAL", "OTHER_MANUAL"]),
  sourceUrl: HttpsUrl.optional(),
  videoUrl: HttpsUrl,
  generatedScript: z.string().trim().min(10).max(20_000),
  durationSeconds: z.number().int().min(1).max(600).optional(),
  costVnd: z.number().finite().min(0).max(1_000_000_000).default(0),
});

/** Luồng API: chỉ mở khi có TOPVIEW_API_KEY (gói Pro/Business). */
export const TopViewGenerateSchema = z.object({
  productItemId: z.string().trim().min(1).max(100),
  productName: z.string().trim().min(3).max(500),
  productUrl: HttpsUrl,
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  durationSeconds: z.number().int().min(5).max(60).default(15),
});

export const ClaimVerdictSchema = z.object({
  claim: z.string().trim().min(1).max(300),
  risk: z.enum(["HIGH", "MEDIUM", "LOW"]),
  verdict: z.enum(["VERIFIED", "REMOVED", "UNVERIFIED"]),
});

export const ContentReviewDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  claimReviews: z.array(ClaimVerdictSchema).max(200),
  aigcLabelAcknowledged: z.boolean(),
  reviewNote: z.string().trim().max(2_000).default(""),
});

export type ManualVideoIngestInput = z.infer<typeof ManualVideoIngestSchema>;
export type TopViewGenerateInput = z.infer<typeof TopViewGenerateSchema>;
export type ContentReviewDecisionInput = z.infer<typeof ContentReviewDecisionSchema>;
