/**
 * Fast local estimate for UI comparison, not billing: the larger of
 * characters / 4 and words * 1.3, rounded up.
 */
export function estimateApproximateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).length;
  return Math.ceil(Math.max(trimmed.length / 4, words * 1.3));
}

export function countWords(text: string): number {
  const matches = text.trim().match(/[\p{L}\p{N}_'-]+/gu);
  return matches?.length ?? 0;
}
