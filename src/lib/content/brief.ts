export interface ManualBriefInput {
  productName: string;
  audience: string;
  painPoint: string;
  hook: string;
  proof: string;
  cta: string;
}

export interface BriefScene {
  time: string;
  purpose: string;
  direction: string;
}

export interface ManualBrief {
  scenes: BriefScene[];
  ready: boolean;
  missing: string[];
}

export function buildManualBrief(input: ManualBriefInput): ManualBrief {
  const required: Array<[keyof ManualBriefInput, string]> = [
    ["productName", "sản phẩm"], ["audience", "khách hàng mục tiêu"], ["painPoint", "nỗi đau"],
    ["hook", "hook 3 giây"], ["proof", "bằng chứng/demo"], ["cta", "CTA"],
  ];
  const missing = required.filter(([key]) => !input[key].trim()).map(([, label]) => label);
  return {
    ready: missing.length === 0,
    missing,
    scenes: [
      { time: "0–3s", purpose: "Dừng cuộn", direction: input.hook.trim() || "Chưa nhập hook" },
      { time: "3–8s", purpose: "Nêu vấn đề", direction: input.painPoint.trim() || "Chưa nhập nỗi đau" },
      { time: "8–18s", purpose: "Demo và bằng chứng", direction: input.proof.trim() || "Chưa nhập bằng chứng" },
      { time: "18–25s", purpose: "Kêu gọi hành động", direction: input.cta.trim() || "Chưa nhập CTA" },
    ],
  };
}
