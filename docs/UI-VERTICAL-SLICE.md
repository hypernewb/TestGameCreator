# Player UI visual language and bedroom vertical slice

This document freezes the first player-facing UI direction. It applies to the visual-novel scene, choices, free-form actions, history, pause menu, and preferences. The studio and developer tools remain separate.

## Visual direction

Modern, warm, and editorial. The interface borrows strong hierarchy and deliberate empty space from modern narrative games while replacing science-fiction signals with rounded translucent walnut surfaces, copper highlights, quiet paper layers, and soft motion. The background and characters remain the focus.

## Design tokens

| Role | Value |
| --- | --- |
| Ink | `#211c18` |
| Walnut | `#352a22` |
| Raised walnut | `#4a382b` |
| Paper | `#e7d5b5` |
| Ivory | `#f3ead9` |
| Copper action | `#a65f3f` |
| Copper hover | `#cc8560` |
| Brass detail | `#c09a55` |
| Muted sage | `#71806a` |
| Small radius | `9–12px` |
| Panel radius | `18–24px` |
| Fast motion | `160ms` |
| Scene motion | `280ms` |
| Primary easing | `cubic-bezier(.2,.8,.2,1)` |

Use one copper action per visual group. Brass indicates metadata and ornament rather than primary interaction. Paper belongs to reading surfaces; walnut belongs to navigation and system surfaces.

## Typography

The default is bundled Source Sans 3. Noto Sans, Open Sans, and Lato are bundled alternatives. Each is stored under `public/assets/fonts` with its SIL Open Font License. A player may load WOFF2, WOFF, TTF, or OTF from Preferences → UI. Uploaded fonts stay local and fall back safely if unavailable.

- Dialogue: 19px at desktop size, 1.58 line height.
- Menu item: 18px, semibold.
- Major heading: 36–74px depending on context.
- Metadata: 9–11px, uppercase, increased letter spacing.
- Never rely on italics for hierarchy.

## Components

- **Dialogue page:** layered paper, inset printed rule, protruding speaker tab, readable at two to four lines. Longer text scrolls or paginates in the runtime.
- **Free-form composer:** a narrow translucent command surface below dialogue. It stays subordinate to authored choices.
- **Choices:** centered walnut panel with paper rows and a clear copper hover state.
- **Menu:** left-weighted composition over a dimmed scene. Options share one translucent rounded surface.
- **History:** lighter walnut modal with individual readable entries.
- **Status:** compact floating state for generation and recoverable errors. It never erases committed player input.
- **Icons:** original monoline SVG symbols in `public/assets/showcase/ui-icons.svg`; rounded caps and joins, 1.8–1.9px stroke.

## Motion

- Dialogue enters over 280–300ms with a short upward settle.
- Characters enter over 480ms with a small horizontal offset and no exaggerated bounce.
- Hover changes complete within 160ms.
- Loading uses one brass spinner; errors replace it with a static mark.
- All nonessential animation stops under `prefers-reduced-motion`.

## Bedroom composition

- Background fills 16:9 using `object-fit: cover`.
- Character art occupies at most 83% of viewport height on desktop.
- The character stands on the right third so the desk and room context remain visible.
- Dialogue and input occupy the lower portion. Faces, eyes, and important hand gestures must stay above this safe zone.
- Temporary Mina art: `public/assets/showcase/test-character.png`, 832×1216 transparent PNG.

## Vertical-slice state checklist

- [x] Narration
- [x] Inner voice
- [x] Character dialogue
- [x] Player free-text action
- [x] Authored choices
- [x] Loading/generation feedback
- [x] Recoverable error and retry
- [x] Long dialogue preview
- [x] History
- [x] Pause menu
- [x] UI preferences
- [x] Four bundled fonts and local font upload
- [x] Responsive fallback and reduced motion

The Preferences UI tab contains temporary state-preview buttons so these cases can be checked without manipulating game data. Remove that preview row when the design is integrated into the production runtime.
