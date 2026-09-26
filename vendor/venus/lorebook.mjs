// Adapted from Venus University, src/renderer/prompts/lorebook.ts and
// src/shared/sentences.ts at commit 79301df55bc39a0996229ccc6f12ccce422a80b2.
// Copyright Venus Dev and contributors. AGPL-3.0-only; see ./LICENSE.
// Changes: TypeScript annotations removed; the static world-specific LOREBOOK was replaced
// with caller-supplied keys. No Venus University world text or assets are included.

/** A string as a regex that matches it literally. */
export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** One key as a regex source fragment. */
export function keyPattern(key, plural = true) {
  const words = key.trim().split(/\s+/).map((word) => escapeRegExp(word))
  const last = words.length - 1
  // `\b` needs a word character on the inside edge: a key ending in punctuation never fires.
  const tail = plural ? `${words[last]}(?:e?s)?` : words[last]
  return `\\b${words.slice(0, last).concat(tail).join('\\s+')}\\b`
}

/** The same case-insensitive, word-boundary matching applied to per-game lore keys. */
export function matchedLoreKeys(keys, scanned) {
  return keys.filter((key) => typeof key === 'string' && key.trim() && new RegExp(keyPattern(key), 'iu').test(scanned))
}

/** A mentioned character outside the cast can inform dialogue without entering the scene. */
export function absentNote(name) {
  return `${name} is NOT here and is background information only — do not have them appear, speak, be shown, or send messages.`
}
