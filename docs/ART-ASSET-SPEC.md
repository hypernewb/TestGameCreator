# Art asset specification

This is the production contract for art used by the modern VN player. The bedroom vertical slice is the reference composition.

## Shared visual direction

Use a contemporary illustrated VN look with warm, rustic materials: aged cream, terracotta, walnut brown, muted brass, charcoal, and soft daylight. Keep shapes clean and current. Avoid science-fiction displays, pixel art, collage typography, copyrighted characters, logos, or a direct imitation of another game's interface.

Palette anchors: `#f5edda` paper, `#9c5139` terracotta, `#633328` dark rust, `#c49755` brass, `#241e1a` ink, `#6f625a` warm gray.

## Background contract

| Property | Requirement |
| --- | --- |
| Delivery | 1920 × 1080, sRGB, JPG quality 90–95 or lossless PNG |
| Composition | 16:9, camera at human eye height, no baked-in characters or UI |
| Critical safe area | Keep faces, clues, and readable props inside x=6–94%, y=8–61% |
| Dialogue reserve | Bottom 39% may be covered by dialogue, choices, and the prompt composer |
| HUD reserve | Keep the upper 90 px visually quiet at both corners |
| Character lane | Leave a low-detail area near x=56–82% for a single foreground sprite |
| Lighting | One clear key-light direction; record it with the asset |

Generate at 1344 × 768 or another native model-friendly 16:9 size, then upscale and crop to 1920 × 1080. Do not stretch a 4:3 image. The current bedroom is test art and uses `object-fit: cover`, so its outer top and bottom can crop at widescreen sizes.

## Character contract

| Property | Requirement |
| --- | --- |
| Delivery | 1024 × 1536 transparent PNG, sRGB, straight alpha |
| Framing | Head through upper thigh or knee; never clip hair, elbows, or hands |
| Alignment | Eyes at 24–30% of canvas height; body center at 50%; 48 px transparent edge padding |
| Baseline | All poses for a character share the same canvas, eye line, and foot/bottom anchor |
| Light | Match the background key-light direction and color temperature |
| Edge quality | No halo, checkerboard, black matte, or semitransparent background remnants |

Required first-pass expressions: `neutral`, `smile`, `concerned`, `frustrated`. Keep clothing, proportions, camera, crop, and seed/reference consistent. Expressions should change the face and small body-language cues rather than redesign the character.

Runtime slots are left, center-left, center-right, and right. One-character scenes should use center-right so the dialogue nameplate and reading path remain clear. Non-speaking sprites receive a mild darkening treatment in the runtime.

## ComfyUI prompt templates

Background positive prompt:

```text
contemporary visual novel background, warm rustic interior, [LOCATION], [TIME OF DAY], hand-painted anime realism, clean architectural perspective, restrained warm palette, walnut brown and aged cream materials, soft natural key light from [DIRECTION], detailed but uncluttered, cinematic 16:9 composition, empty room, no people, quiet upper corners, low-detail character lane on the right
```

Background negative prompt:

```text
people, character, text, logo, watermark, fisheye, extreme wide angle, dutch angle, sci-fi interface, cyberpunk neon, pixel art, photorealistic photograph, blurry, low detail, distorted furniture, duplicate objects
```

Character positive prompt:

```text
adult [CHARACTER DESCRIPTION], contemporary visual novel character sprite, [OUTFIT], [EXPRESSION], relaxed natural pose, head to knees, front three-quarter view, consistent anatomy and proportions, clean painted linework, soft warm key light from upper left, subtle bounce light, transparent background, centered on a 2:3 canvas
```

Character negative prompt:

```text
background, scenery, text, logo, watermark, cropped hair, cropped hands, cut off elbows, extra fingers, extra limbs, malformed hands, duplicate body, heavy rim light, neon, pixel art, chibi, photorealistic
```

Use one approved neutral sprite as the image reference for expression variants. Lock the seed where the workflow permits it, lower denoise for variants, and judge consistency at runtime scale. Remove the background after generation and inspect edges over cream, charcoal, and terracotta before export.

## File naming and acceptance

- Background: `location-id_time-of-day_v01.jpg`
- Sprite: `character-id_expression_outfit_v01.png`
- Keep source workflow JSON beside generated masters, outside the public runtime folder.
- Accept an asset only after it has been viewed at 1920 × 1080 with the dialogue box, choice stack, HUD, and prompt composer visible.
