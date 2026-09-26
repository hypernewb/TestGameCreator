// Adapted from Venus University, src/shared/sceneActions.ts at commit
// 79301df55bc39a0996229ccc6f12ccce422a80b2.
// Copyright Venus Dev and contributors. AGPL-3.0-only; see ./LICENSE.
// Changes: TypeScript annotations removed; sprite validation is supplied by the caller;
// Venus-specific CG positions are omitted. This module parses only show/hide/sprite actions.

/** Parses one raw stage instruction, or null for anything malformed. */
export function parseAction(raw, validSprite = () => false) {
  const at = raw.indexOf(':')
  if (at < 0) return null
  const verb = raw.slice(0, at)
  const rest = raw.slice(at + 1)

  if (verb === 'show' || verb === 'hide') {
    return rest ? { kind: verb, charKey: rest } : null
  }

  if (verb === 'sprite') {
    const comma = rest.indexOf(',')
    if (comma < 0) return null
    const charKey = rest.slice(0, comma).trim()
    const ref = rest.slice(comma + 1).trim()
    if (!charKey || !validSprite(charKey, ref)) return null
    return { kind: 'sprite', charKey, ref }
  }

  return null
}

/** `show:actor_id` or `hide:actor_id`. */
export function showAction(kind, charKey) {
  return `${kind}:${charKey}`
}

/** `sprite:actor_id,pose_id`. */
export function spriteAction(charKey, ref) {
  return `sprite:${charKey},${ref}`
}
