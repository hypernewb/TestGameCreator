# Patterns to borrow from VN and UI tools

Our editor currently styles and previews screens. Mature VN engines also connect those screens to real save state, dialogue history, preferences and input handling. The next structural step is an explicit, tested action/data binding layer between this editor and the deterministic engine.

| Tool | Documented pattern | Application here |
| --- | --- | --- |
| [Ren'Py](https://www.renpy.org/doc/html/screens.html#imagebutton) | Image buttons have separate actions and idle/hover/selected/insensitive visuals. | Keep icon artwork independent of function; add an editor for each visual state next. Current utility icons already have hover, pressed and keyboard focus treatments. |
| [TyranoBuilder](https://tyranobuilder.com/tutorials/more/customize-the-user-interface) | Add system buttons visually, drag them into position and replace their artwork with transparent PNGs. | Make system controls selectable on the canvas, with custom SVG/PNG replacement and accessible tooltip names. Current quick-menu icons follow this pattern; the container can move/resize as a group. |
| [Naninovel](https://pre.naninovel.com/guide/gui) | Replaceable UI templates, adaptive layout, visibility and focus management. | Save reusable component/screen presets, add anchor/stack layout tools and connect each panel to validated engine state. Current menus wrap on phone and preserve panel focus. |
| [Figma](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) | Component variants organize differences such as size, state and icon. | Build a reusable component library rather than styling repeated copies separately; expose size/state variants and instance overrides. |

Recommended next order: reusable presets and state editing; responsive anchors and spacing; explicit engine bindings; full save/load/history/settings screens. Adapt the interaction and authoring patterns while keeping the campus artwork original.

T-068 implements nine independently customizable quick-menu icons. Save/load operate only on a session preview position. Settings edit actual preview preferences. Dossier and location open existing preview screens. History, planner, inventory and updates are labeled integration placeholders. No game-engine changes were made.
