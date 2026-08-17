import { detectClaims } from "./claim-detector.ts";

export type PromptTarget = "UGC_VIDEO" | "CINEMATIC_VIDEO";
export type PromptTone = "energetic" | "calm" | "premium" | "playful";
export type AspectRatio = "9:16" | "1:1" | "16:9";

export interface VisualPromptInput {
  target: PromptTarget;
  subjectEn: string;
  audienceEn: string;
  settingEn: string;
  useCaseEn: string;
  tone: PromptTone;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  presenterEn?: string;
}

export interface PromptShot {
  range: string;
  purpose: string;
  direction: string;
}

export interface VisualPrompt {
  target: PromptTarget;
  prompt: string;
  negativePrompt: string;
  shots: PromptShot[];
  warnings: string[];
  missing: string[];
  ready: boolean;
}

const TONE_STYLE: Record<PromptTone, { look: string; pace: string }> = {
  energetic: { look: "bright saturated colors, high contrast", pace: "quick cuts, dynamic handheld motion" },
  calm: { look: "soft natural light, muted warm palette", pace: "slow steady movement, long takes" },
  premium: { look: "clean studio lighting, deep shadows, glossy surfaces", pace: "smooth controlled camera moves" },
  playful: { look: "colorful props, cheerful daylight", pace: "bouncy motion, snappy transitions" },
};

const UGC_BEATS = [
  { weight: 0.12, purpose: "Hook", template: (input: VisualPromptInput) => `presenter holds up the ${input.subjectEn} close to camera and reacts with surprise` },
  { weight: 0.2, purpose: "Problem", template: (input: VisualPromptInput) => `show the messy or inconvenient situation in ${input.settingEn} before using the product` },
  { weight: 0.42, purpose: "Demo", template: (input: VisualPromptInput) => `presenter demonstrates ${input.useCaseEn} with the ${input.subjectEn}, close-up on hands and product` },
  { weight: 0.26, purpose: "Close", template: (input: VisualPromptInput) => `presenter holds the ${input.subjectEn} toward camera and gestures to the description below` },
];

const CINEMATIC_BEATS = [
  { weight: 0.22, purpose: "Establish", template: (input: VisualPromptInput) => `slow dolly-in on the ${input.subjectEn} resting in ${input.settingEn}` },
  { weight: 0.28, purpose: "Detail", template: (input: VisualPromptInput) => `macro orbit around the ${input.subjectEn}, shallow depth of field on texture and material` },
  { weight: 0.32, purpose: "In use", template: (input: VisualPromptInput) => `hands perform ${input.useCaseEn}, camera tracks the motion at product level` },
  { weight: 0.18, purpose: "Hero", template: (input: VisualPromptInput) => `static hero shot of the ${input.subjectEn}, clean background, product centered` },
];

const NEGATIVE_PROMPT = [
  "on-screen text", "watermark", "brand logo", "price tag", "percentage badge",
  "before-and-after comparison", "medical or health claim on screen",
  "distorted hands", "extra fingers", "warped product shape", "blurry product",
].join(", ");

const REQUIRED_FIELDS: Array<[keyof VisualPromptInput, string]> = [
  ["subjectEn", "mô tả sản phẩm bằng tiếng Anh"],
  ["audienceEn", "khách hàng mục tiêu"],
  ["settingEn", "bối cảnh"],
  ["useCaseEn", "hành động sử dụng"],
];

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();

function buildShots(input: VisualPromptInput): PromptShot[] {
  const beats = input.target === "UGC_VIDEO" ? UGC_BEATS : CINEMATIC_BEATS;
  let elapsed = 0;
  return beats.map(beat => {
    const start = Math.round(elapsed);
    elapsed += input.durationSeconds * beat.weight;
    const end = Math.round(elapsed);
    return { range: `${start}-${end}s`, purpose: beat.purpose, direction: beat.template(input) };
  });
}

/**
 * Prompt chỉ mô tả hình ảnh, không khẳng định công dụng. Mọi câu mang tính
 * quảng cáo hiệu quả đều bị cảnh báo — công cụ tạo video sẽ vẽ nó thành chữ
 * trên màn hình và biến thành claim bạn không chứng minh được.
 */
export function buildVisualPrompt(input: VisualPromptInput): VisualPrompt {
  const missing = REQUIRED_FIELDS.filter(([key]) => !collapse(String(input[key] ?? "")))
    .map(([, label]) => label);
  const style = TONE_STYLE[input.tone];
  const shots = buildShots(input);

  const claimSources = [input.subjectEn, input.useCaseEn, input.settingEn, input.audienceEn].join(". ");
  const warnings = detectClaims(claimSources)
    .filter(claim => claim.risk === "HIGH")
    .map(claim => `Bỏ khỏi prompt: "${claim.claim}" — ${claim.reasons.join(", ")}.`);

  const header = input.target === "UGC_VIDEO"
    ? `UGC-style vertical product video, ${input.durationSeconds} seconds, ${input.aspectRatio}, filmed on a phone.`
    : `Cinematic product film, ${input.durationSeconds} seconds, ${input.aspectRatio}.`;

  const presenter = input.target === "UGC_VIDEO"
    ? `Presenter: ${collapse(input.presenterEn || "everyday person, natural look, casual clothing")}, speaking to camera, authentic and unpolished.`
    : "No presenter. Product is the subject.";

  const prompt = [
    header,
    `Subject: ${collapse(input.subjectEn)}.`,
    `Audience it is shot for: ${collapse(input.audienceEn)}.`,
    `Setting: ${collapse(input.settingEn)}.`,
    `Action: ${collapse(input.useCaseEn)}.`,
    presenter,
    `Look: ${style.look}. Motion: ${style.pace}.`,
    "Shot sequence:",
    ...shots.map(shot => `  ${shot.range} — ${shot.purpose}: ${shot.direction}.`),
    "Keep the product shape, color and proportions accurate. No text, captions or claims rendered in frame.",
  ].join("\n");

  return {
    target: input.target,
    prompt,
    negativePrompt: NEGATIVE_PROMPT,
    shots,
    warnings,
    missing,
    ready: missing.length === 0 && warnings.length === 0,
  };
}

/** Gợi ý mô tả tiếng Anh từ danh mục Shopee để bạn khỏi phải nghĩ từ đầu. */
const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/hút bụi|máy hút/i, "handheld vacuum cleaner"],
  [/tai nghe|headphone|earbud/i, "wireless earbuds"],
  [/sạc|cáp|pin dự phòng/i, "fast charging cable and power bank"],
  [/đèn|led/i, "LED desk lamp"],
  [/bình|ly|cốc/i, "insulated water bottle"],
  [/balo|túi/i, "everyday backpack"],
  [/giày|dép/i, "casual sneakers"],
  [/áo|quần|váy/i, "casual clothing item"],
  [/kem|serum|dưỡng|mỹ phẩm/i, "skincare bottle"],
  [/bếp|nồi|chảo/i, "kitchen cookware"],
  [/quạt/i, "portable fan"],
  [/chuột|bàn phím|keyboard|mouse/i, "computer peripheral"],
  [/điện thoại|ốp lưng/i, "phone accessory"],
  [/đồng hồ/i, "wristwatch"],
];

export function suggestSubjectEn(productName: string, category?: string): string {
  const haystack = `${productName} ${category ?? ""}`;
  const match = CATEGORY_HINTS.find(([pattern]) => pattern.test(haystack));
  return match ? match[1] : "";
}
