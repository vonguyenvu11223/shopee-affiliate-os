import type { ClaimRisk } from "@/lib/content/video-provenance";

export interface DetectedClaim {
  claim: string;
  risk: ClaimRisk;
  reasons: string[];
}

interface ClaimRule {
  code: string;
  risk: Exclude<ClaimRisk, "LOW">;
  pattern: RegExp;
}

/**
 * Phát hiện claim bằng luật deterministic, không dùng LLM.
 * Script đến từ TopView được sinh ra từ trang sản phẩm do seller kiểm soát,
 * nên nội dung này luôn bị coi là dữ liệu không tin cậy.
 */
const CLAIM_RULES: ClaimRule[] = [
  { code: "MEDICAL", risk: "HIGH", pattern: /\b(chữa|đặc trị|trị dứt điểm|khỏi bệnh|kháng viêm|giảm cân|tăng cân|trắng da cấp tốc|không tác dụng phụ|an toàn tuyệt đối|thải độc)\b/ },
  { code: "MEDICAL", risk: "HIGH", pattern: /\b(cures?|heals?|treats? (acne|pain|illness)|detox(ifies)?|weight loss|no side effects|completely safe|clinically proven)\b/ },
  { code: "GUARANTEE", risk: "HIGH", pattern: /(cam kết|đảm bảo|chắc chắn|hoàn tiền 100|bảo hành trọn đời|vĩnh viễn|tuyệt đối)/ },
  { code: "GUARANTEE", risk: "HIGH", pattern: /\b(guarantee[ds]?|money[- ]back|lifetime warranty|permanently|risk[- ]free)\b/ },
  { code: "SUPERLATIVE", risk: "HIGH", pattern: /(tốt nhất|rẻ nhất|số 1|số một|top 1|duy nhất trên thị trường|không đối thủ|hàng đầu thế giới)/ },
  { code: "SUPERLATIVE", risk: "HIGH", pattern: /\b(the best|best (on|in) the (market|world)|cheapest|number one|no\.? ?1\b|unmatched|world'?s leading)\b/ },
  { code: "PERSONAL_EXPERIENCE", risk: "HIGH", pattern: /(mình đã dùng|tôi đã dùng|mình dùng \d|sau \d+ (ngày|tuần|tháng) (dùng|sử dụng)|bản thân mình|review thật của mình)/ },
  { code: "PERSONAL_EXPERIENCE", risk: "HIGH", pattern: /\b(i (have )?(used|tried|been using)|after \d+ (days?|weeks?|months?) of (use|using)|my honest review)\b/ },
  { code: "MEASURED_RESULT", risk: "HIGH", pattern: /(giảm|tăng|tiết kiệm|hiệu quả)\s*(đến|tới|lên đến|khoảng)?\s*\d+\s*(%|phần trăm|lần|kg|cm)/ },
  { code: "MEASURED_RESULT", risk: "HIGH", pattern: /\b(reduces?|increases?|saves?|removes?|eliminates?|lasts?)\s*(up to|about|around)?\s*\d+\s*(%|percent|times|x\b|kg|cm|hours?)/ },
  { code: "CERTIFICATION", risk: "MEDIUM", pattern: /(chứng nhận|kiểm định|đạt chuẩn|fda|iso \d|bộ y tế|chính hãng 100)/ },
  { code: "CERTIFICATION", risk: "MEDIUM", pattern: /\b(certified|lab[- ]tested|approved by|meets? .{0,12}standard)\b/ },
  { code: "PROMOTION", risk: "MEDIUM", pattern: /(giảm giá|sale sốc|freeship|miễn phí vận chuyển|voucher|deal sốc|giá chỉ còn|rẻ hơn)/ },
  { code: "PROMOTION", risk: "MEDIUM", pattern: /\b(discount|free shipping|voucher|flash sale|special offer|only \$?\d)\b/ },
  { code: "COMPARISON", risk: "MEDIUM", pattern: /(hơn hẳn|vượt trội|đánh bại|so với các loại khác|thay thế hoàn toàn)/ },
  { code: "COMPARISON", risk: "MEDIUM", pattern: /\b(better than|outperforms?|beats? (other|the)|fully replaces?)\b/ },
  { code: "STATISTIC", risk: "MEDIUM", pattern: /\d+\s*(%|phần trăm|percent)|\b\d{3,}\s*(người|khách|lượt|đơn|customers|reviews|sold)\b/ },
  { code: "URGENCY", risk: "MEDIUM", pattern: /(sắp hết hàng|chỉ còn \d+|nhanh tay|cuối cùng hôm nay|số lượng có hạn)/ },
  { code: "URGENCY", risk: "MEDIUM", pattern: /\b(almost sold out|only \d+ left|hurry|limited stock|last chance)\b/ },
];

const RULE_LABELS: Record<string, string> = {
  MEDICAL: "Claim y tế/sức khỏe",
  GUARANTEE: "Cam kết tuyệt đối",
  SUPERLATIVE: "So sánh nhất",
  PERSONAL_EXPERIENCE: "Trải nghiệm cá nhân mà bạn không thực sự có",
  MEASURED_RESULT: "Kết quả định lượng",
  CERTIFICATION: "Chứng nhận/kiểm định",
  PROMOTION: "Khuyến mãi/giá",
  COMPARISON: "So sánh với sản phẩm khác",
  STATISTIC: "Số liệu thống kê",
  URGENCY: "Tạo khan hiếm",
};

export function splitScriptSentences(script: string): string[] {
  return script
    .split(/(?<=[.!?…])\s+|\n+|(?:^|\s)[-•*]\s+/u)
    .map(sentence => sentence.replace(/\s+/g, " ").trim())
    .filter(sentence => sentence.length >= 4);
}

export function detectClaims(script: string): DetectedClaim[] {
  const seen = new Set<string>();
  const claims: DetectedClaim[] = [];
  for (const sentence of splitScriptSentences(script)) {
    const haystack = sentence.toLowerCase();
    const matched = CLAIM_RULES.filter(rule => rule.pattern.test(haystack));
    if (!matched.length) continue;
    const key = haystack;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      claim: sentence.slice(0, 300),
      risk: matched.some(rule => rule.risk === "HIGH") ? "HIGH" : "MEDIUM",
      reasons: [...new Set(matched.map(rule => RULE_LABELS[rule.code]))],
    });
  }
  return claims;
}

export function summarizeClaimRisk(claims: DetectedClaim[]) {
  return {
    total: claims.length,
    high: claims.filter(claim => claim.risk === "HIGH").length,
    medium: claims.filter(claim => claim.risk === "MEDIUM").length,
  };
}
