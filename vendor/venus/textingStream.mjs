// Adapted from Venus University renderer/stores/textingStream.ts
// Snapshot 79301df55bc39a0996229ccc6f12ccce422a80b2. AGPL-3.0-only; see LICENSE and NOTICE.md.
import { createArrayExtractor, stringElement } from './jsonStream.mjs'

/**
 * Incremental preview reader for streaming `TextingResponse` JSON — the texting
 * counterpart of `sceneStream.ts`.
 */

/** A reader that turns a growing JSON prefix into the texts completed so far. */
                                
                                                                                    
                                   
 

/** Creates a {@link TextExtractor} — the `messages` array of strings (see `jsonStream.ts`). */
export function createTextExtractor()                {
  return createArrayExtractor        ('messages', stringElement, '[texting]')
}
