export type AffiliatePlatform = "tiktok" | "youtube" | "facebook" | "instagram" | "other";

export interface TrackingPlanInput {
  platform: AffiliatePlatform;
  channel: string;
  contentKey: string;
  variant: string;
  campaign: string;
}

export interface TrackingPlan {
  subId1: string;
  subId2: string;
  subId3: string;
  subId4: string;
  subId5: string;
  attributionKey: string;
  complete: boolean;
}

export function normalizeTrackingToken(value: string, fallback = "na"): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 40);
  return normalized || fallback;
}

/** Gắn Sub_id vào link affiliate để báo cáo Shopee quy được đơn về đúng nội dung. */
export function applySubIdsToAffiliateUrl(affiliateUrl: string, plan: TrackingPlan): string {
  let url: URL;
  try { url = new URL(affiliateUrl); }
  catch { return affiliateUrl; }
  const subIds = [plan.subId1, plan.subId2, plan.subId3, plan.subId4, plan.subId5];
  subIds.forEach((value, index) => url.searchParams.set(`sub_id${index + 1}`, value));
  return url.toString();
}

export function createTrackingPlan(input: TrackingPlanInput): TrackingPlan {
  const subId1 = normalizeTrackingToken(input.platform);
  const subId2 = normalizeTrackingToken(input.channel);
  const subId3 = normalizeTrackingToken(input.contentKey);
  const subId4 = normalizeTrackingToken(input.variant, "v1");
  const subId5 = normalizeTrackingToken(input.campaign);
  const complete = Boolean(input.channel.trim() && input.contentKey.trim() && input.campaign.trim());
  return {
    subId1, subId2, subId3, subId4, subId5,
    attributionKey: [subId1, subId2, subId3, subId4, subId5].join("."),
    complete,
  };
}
