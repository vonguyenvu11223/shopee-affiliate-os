import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ContentExperimentInput } from "@/lib/content/experiment-schema";
import { createTrackingPlan } from "@/lib/attribution/tracking";

export async function persistContentExperiment(userId: string, input: ContentExperimentInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase Database chưa được cấu hình.");
  const { data: product, error: productError } = await supabase.from("products").select("id").eq("item_id", input.productItemId).single();
  if (productError || !product) throw new Error("Sản phẩm chưa tồn tại trong Product DB của tài khoản.");
  const tracking = createTrackingPlan({ platform: input.platform, channel: input.channel, contentKey: input.contentKey, variant: input.variant, campaign: input.campaign });
  const brief = { audience: input.audience, painPoint: input.painPoint, proof: input.proof, scenes: [
    { time: "0-3s", text: input.hook }, { time: "3-8s", text: input.painPoint },
    { time: "8-18s", text: input.proof }, { time: "18-25s", text: input.cta },
  ], subIds: [tracking.subId1, tracking.subId2, tracking.subId3, tracking.subId4, tracking.subId5] };
  const contentHash = createHash("sha256").update(JSON.stringify({ product: input.productItemId, tracking: tracking.attributionKey, brief })).digest("hex");

  const { data: project, error: projectError } = await supabase.from("content_projects").insert({
    user_id: userId, product_id: product.id, title: `${input.productName} · ${input.contentKey}`,
    platform: input.platform.toUpperCase(), content_cost: input.budget, status: "DRAFT",
  }).select("id").single();
  if (projectError) throw new Error(`Không thể lưu content project: ${projectError.message}`);
  const { data: contentVariant, error: variantError } = await supabase.from("content_variants").insert({
    user_id: userId, content_project_id: project.id, hook: input.hook, cta: input.cta,
    duration_seconds: 25, script: JSON.stringify(brief.scenes), content_hash: contentHash,
    tracking_key: tracking.attributionKey, brief,
  }).select("id").single();
  if (variantError) {
    await supabase.from("content_projects").delete().eq("id", project.id);
    if (variantError.code === "23505") throw new Error("Content/tracking này đã được lưu trước đó.");
    throw new Error(`Không thể lưu content variant: ${variantError.message}`);
  }
  const { data: experiment, error: experimentError } = await supabase.from("content_experiments").insert({
    user_id: userId, product_id: product.id, content_variant_id: contentVariant.id,
    state: "TESTING", budget: input.budget,
  }).select("id").single();
  if (experimentError) {
    await supabase.from("content_projects").delete().eq("id", project.id);
    throw new Error(`Không thể tạo experiment: ${experimentError.message}`);
  }
  const { error: auditError } = await supabase.from("audit_logs").insert({
    user_id: userId, action: "CONTENT_EXPERIMENT_CREATED", entity_type: "content_experiment",
    entity_id: experiment.id, metadata: { tracking_key: tracking.attributionKey, content_cost: input.budget },
  });
  if (auditError) {
    await supabase.from("content_projects").delete().eq("id", project.id);
    throw new Error(`Không thể ghi audit log; experiment đã được rollback: ${auditError.message}`);
  }
  return { projectId: project.id, variantId: contentVariant.id, experimentId: experiment.id, trackingKey: tracking.attributionKey };
}
