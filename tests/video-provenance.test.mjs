import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionReview, evaluateContentReleaseGate, requiresAigcLabel, resolveProvenance,
} from "../src/lib/content/video-provenance.ts";

const approvedBase = {
  provenance: "AI_GENERATED_UNVERIFIED",
  reviewStatus: "APPROVED",
  generatedScript: "Script do AI sinh.",
  detectedClaimCount: 1,
  claimReviews: [{ claim: "Tốt nhất thị trường", risk: "HIGH", verdict: "REMOVED" }],
  aigcLabelAcknowledged: true,
  reviewNote: "Đã cắt claim so sánh nhất.",
};

test("TopView output is always treated as unverified AI content", () => {
  assert.equal(resolveProvenance("TOPVIEW_API"), "AI_GENERATED_UNVERIFIED");
  assert.equal(resolveProvenance("TOPVIEW_WEB_MANUAL"), "AI_GENERATED_UNVERIFIED");
  assert.equal(requiresAigcLabel("AI_GENERATED_UNVERIFIED"), true);
  assert.equal(requiresAigcLabel("USER_AUTHORED"), false);
});

test("releases only when every gate condition is met", () => {
  const gate = evaluateContentReleaseGate(approvedBase);
  assert.equal(gate.releasable, true);
  assert.deepEqual(gate.blockers, []);
});

test("blocks release while the video is still generating", () => {
  const gate = evaluateContentReleaseGate({ ...approvedBase, reviewStatus: "GENERATING" });
  assert.equal(gate.releasable, false);
  assert.ok(gate.blockers.includes("GENERATION_INCOMPLETE"));
});

test("blocks release when a high risk claim stays unverified", () => {
  const gate = evaluateContentReleaseGate({
    ...approvedBase,
    claimReviews: [{ claim: "Chữa dứt điểm", risk: "HIGH", verdict: "UNVERIFIED" }],
  });
  assert.equal(gate.releasable, false);
  assert.equal(gate.unresolvedHighRiskClaims, 1);
  assert.ok(gate.blockers.includes("UNRESOLVED_HIGH_RISK_CLAIM"));
});

test("allows an unverified medium risk claim through", () => {
  const gate = evaluateContentReleaseGate({
    ...approvedBase,
    claimReviews: [{ claim: "Đang có freeship", risk: "MEDIUM", verdict: "UNVERIFIED" }],
  });
  assert.equal(gate.releasable, true);
});

test("blocks release when reviewed claims do not cover every detected claim", () => {
  const gate = evaluateContentReleaseGate({ ...approvedBase, detectedClaimCount: 3 });
  assert.ok(gate.blockers.includes("CLAIM_COUNT_MISMATCH"));
});

test("requires the AI label acknowledgement and a review note", () => {
  const gate = evaluateContentReleaseGate({ ...approvedBase, aigcLabelAcknowledged: false, reviewNote: "  " });
  assert.ok(gate.blockers.includes("AIGC_LABEL_NOT_ACKNOWLEDGED"));
  assert.ok(gate.blockers.includes("REVIEW_NOTE_REQUIRED"));
});

test("skips claim review requirements for human authored content", () => {
  const gate = evaluateContentReleaseGate({
    provenance: "USER_AUTHORED", reviewStatus: "APPROVED", generatedScript: null,
    detectedClaimCount: 0, claimReviews: [], aigcLabelAcknowledged: false, reviewNote: null,
  });
  assert.equal(gate.releasable, true);
  assert.equal(gate.requiresClaimReview, false);
});

test("enforces the review state machine", () => {
  assert.equal(canTransitionReview("GENERATING", "AI_DRAFT"), true);
  assert.equal(canTransitionReview("AI_DRAFT", "APPROVED"), false);
  assert.equal(canTransitionReview("UNDER_REVIEW", "APPROVED"), true);
  assert.equal(canTransitionReview("FAILED", "APPROVED"), false);
});
