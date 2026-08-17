import test from "node:test";
import assert from "node:assert/strict";
import { buildManualBrief } from "../src/lib/content/brief.ts";

test("does not mark a content brief ready when evidence is missing", () => {
  const brief = buildManualBrief({ productName: "Sản phẩm", audience: "Người thuê trọ", painPoint: "Nhà chật", hook: "", proof: "", cta: "Xem link" });
  assert.equal(brief.ready, false);
  assert.deepEqual(brief.missing, ["hook 3 giây", "bằng chứng/demo"]);
});

test("builds deterministic scenes only from user-provided claims", () => {
  const brief = buildManualBrief({ productName: "Sản phẩm", audience: "Người thuê trọ", painPoint: "Nhà chật", hook: "Mở tủ trong 3 giây", proof: "Quay trước và sau", cta: "Xem link" });
  assert.equal(brief.ready, true);
  assert.equal(brief.scenes[0].direction, "Mở tủ trong 3 giây");
  assert.equal(brief.scenes[2].direction, "Quay trước và sau");
});
