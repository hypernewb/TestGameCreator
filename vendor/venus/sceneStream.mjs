// Adapted from Venus University renderer/stores/sceneStream.ts
// Snapshot 79301df55bc39a0996229ccc6f12ccce422a80b2. AGPL-3.0-only; see LICENSE and NOTICE.md.
import { createArrayExtractor, objectElement } from './jsonStream.mjs'

/**
 * Incremental preview reader for streaming `SceneResponse` JSON: emits complete `lines`
 * objects early; the resolved response remains authoritative.
 */

/** A reader that turns a growing JSON prefix into the scene lines completed so far. */
                                
                                                                                 
                                    
 

/** Creates a {@link LineExtractor} — the `lines` array of objects (see `jsonStream.ts`). */
export function createLineExtractor()                {
  return createArrayExtractor         ('lines', objectElement, '[scene]')
}
