import "server-only";

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ContentAiOutputSchema, buildContentAiPrompt, type ContentAiInput, type ContentAiOutput } from "@/lib/ai/content-schema";

export function getOpenAiCapability() {
  return {
    status: process.env.OPENAI_API_KEY?.trim() ? "AVAILABLE" as const : "MANUAL_REQUIRED" as const,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra",
  };
}

export async function generateContentBrief(input: ContentAiInput, userId: string): Promise<ContentAiOutput> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY chưa được cấu hình.");
  const client = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 2 });
  const safetyIdentifier = createHash("sha256").update(`profitos:${userId}`).digest("hex");
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra",
    reasoning: { effort: "low" },
    store: false,
    safety_identifier: safetyIdentifier,
    input: [
      { role: "system", content: "Bạn là Creative Strategist thận trọng cho Shopee Affiliate. Chỉ diễn giải dữ kiện được cung cấp; mọi claim thiếu bằng chứng phải được cảnh báo." },
      { role: "user", content: buildContentAiPrompt(input) },
    ],
    text: { format: zodTextFormat(ContentAiOutputSchema, "affiliate_content_brief") },
  });
  if (!response.output_parsed) throw new Error("AI không trả về brief có cấu trúc hợp lệ.");
  return response.output_parsed;
}
