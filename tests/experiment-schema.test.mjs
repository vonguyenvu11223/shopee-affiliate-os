import test from "node:test";
import assert from "node:assert/strict";
import { ContentExperimentInputSchema } from "../src/lib/content/experiment-schema.ts";

const valid = { productItemId: "123", productName: "Sản phẩm thật", platform: "tiktok", channel: "nguyenvu", contentKey: "video001", variant: "v1", campaign: "test082026", audience: "Người thuê trọ", painPoint: "Không gian nhỏ", hook: "Mở đầu rõ ràng", proof: "Quay demo thực tế", cta: "Xem sản phẩm", budget: 50000 };

test("accepts a fully attributable content experiment", () => {
  assert.equal(ContentExperimentInputSchema.safeParse(valid).success, true);
});

test("rejects tracking fields containing spaces or punctuation", () => {
  assert.equal(ContentExperimentInputSchema.safeParse({ ...valid, contentKey: "video 001!" }).success, false);
});

test("rejects negative content cost", () => {
  assert.equal(ContentExperimentInputSchema.safeParse({ ...valid, budget: -1 }).success, false);
});
