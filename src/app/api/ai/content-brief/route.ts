import { NextResponse } from "next/server";
import { ContentAiInputSchema } from "@/lib/ai/content-schema";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { generateContentBrief, getOpenAiCapability } from "@/providers/ai/openai-content";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";

export async function POST(request: Request) {
  const telemetry = createRequestTelemetry(request, "ai.content_brief.generate");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 3, 60_000);
    const userId = await requireUserAuthorization();
    if (getOpenAiCapability().status !== "AVAILABLE") { telemetry.rejected(503, "PROVIDER_NOT_CONFIGURED"); return NextResponse.json({ error: "AI provider chưa được cấu hình." }, { status: 503 }); }
    const parsed = ContentAiInputSchema.safeParse(await request.json());
    if (!parsed.success) { telemetry.rejected(400, "INVALID_INPUT"); return NextResponse.json({ error: "Thông tin brief chưa đầy đủ hoặc quá dài." }, { status: 400 }); }
    const brief = await generateContentBrief(parsed.data, userId);
    telemetry.completed({ userId, provider: "OPENAI", status: 200 });
    return NextResponse.json({ brief });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 502;
    const message = error instanceof RequestGuardError ? error.message : "AI provider không thể tạo brief lúc này.";
    telemetry.failed(error, { status, provider: "OPENAI" });
    return NextResponse.json({ error: message }, { status });
  }
}
