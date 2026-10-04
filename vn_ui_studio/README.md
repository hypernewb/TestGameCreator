# VN Studio

An offline visual prototype editor. From the repository folder, run:

```
node vn_ui_studio/serve.mjs
```

Open http://127.0.0.1:4176. The server binds only to this computer and serves only the editor and its assets. No installation, build, external fonts, or AI connection is required. Stop with Ctrl+C. Set VN_STUDIO_PORT to use a different port.

- Style: four themes, complete starter presets, accent color, text size, corners, opacity.
- Screens: all nine original previews.
- Layout: select, move, resize, align, lock, show/hide, reorder, reset. Desktop, tablet, and phone keep independent component layouts.
- Interaction: four response modes and choice styles, three input placements, four relationship displays, reduced motion.
- Review & export: JSON download/import and copy, with CSS tokens. Saved locally in the browser. Downloads back up your work outside browser storage.
- Asset lab: 12 original expansion components, enlarged previews, category filters, intended states and placement, and SVG downloads. See ASSET-KIT.md for suggested feature priorities and references.
- Play preview: simulated controls and responses. No engine mutations, model calls, actual audio, or gameplay results.

SVG assets are original local vectors: scene.svg, frame.svg, and icons.svg. The icons file includes 12 individually addressable groups (i-moon, i-wallet, i-spark, i-heart, i-map, i-shop, i-board, i-calendar, i-phone, i-music, i-book, i-arrow).

Coordinates are percentages of each device's canvas. Screens share reusable HUD components. The exported configuration is a prototype handoff format; engine integration must explicitly map allowed actions and visible state.

Select a game component to edit its shape, font, text scale, padding, border, colors, icon, and texture in Properties. Reset appearance or undo to restore it. Import a self-contained SVG or PNG frame (up to 175 KB); adjust the edge slice to keep ornamental corners intact. Appearance is shared across devices, while positions stay independent. Fit content expands small frames; turn it off for exact geometry. Imported frames travel with exported JSON.

Quick-menu icons: History, Save, Load, Settings, Planner, Updates, Dossier, Inventory and Location. In Edit mode click an icon, then change its symbol, tooltip, color, visibility or custom SVG/PNG image under Individual icon. Move/resize the whole quick menu using its frame or Layout entry. Desktop/tablet use a single row; phone uses two rows. Icon artwork is independent of its function, and edits travel with exported layouts. In Play preview icons open accessible panels: settings edit preview preferences; save/load store a screen position for this session only; dossier/map open their preview screens. History, planner, updates and inventory show integration placeholders. These are not engine-backed gameplay features. The icon sprite now also provides i-history, i-save, i-load, i-settings, i-profile and i-bag.

Independent buttons and presets: utility icons are separate canvas widgets; select their button or Layout entry and drag, nudge, resize or lock each independently. Shop/Map/Board/Calendar and utility buttons support Icon only, Icon + label or Label only; horizontal/vertical layout; bare, paper, glass, outlined, tab, or docked-tab skins; icon size, corners and padding. Button states let you edit normal/hover/pressed/selected/disabled colors, opacity and SVG/PNG backgrounds; Canvas state preview can force a state or return to live interaction. State artwork inherits normal artwork until overridden; reset the state to clear an override. Save up to ten named appearance presets, then apply them to another component without replacing its label, action or position. Presets are editable snapshots, not linked instances, and travel with exported JSON. Starter button presets provide common designs (including docked tabs). Component silhouettes also support angled pennant and shield cuts alongside vector asset frames (`hud-frame-flag.svg`, `hud-button-tab.svg`, `hud-radar-pod.svg`). Automatic content fitting keeps main panels below overlapping utility buttons; disable it for exact overlap placement. Older grouped menus migrate to separate device-specific buttons.
