# ComfyUI asset pipeline

Generates persona-theme art (backgrounds and portraits) with a local ComfyUI install, then pulls finished renders into the project. Additive-only: it writes to `public/assets/generated/`, never to the existing SVG placeholders in `public/assets/`, and CSS/HTML aren't touched — wiring a generated file into the UI is a separate, deliberate edit.

The manifest (`packages/assets/manifest.mjs`) is the source of truth for what art exists: one entry per asset id, with its kind (`background`, 1100×520, or `portrait`, 1024×1536), prompt, negative prompt, and the placeholder SVG it corresponds to.

## 1. List assets

```bash
npm run assets:manifest -- list
```

Prints each asset's id, kind, size, and prompt.

## 2. Write ComfyUI workflows

```bash
npm run assets:manifest -- workflows --out generated/comfyui-workflows --checkpoint your_checkpoint.safetensors
```

Writes one ComfyUI API-format workflow JSON per asset (`hub.json`, `ada-neutral.json`, …): checkpoint loader, sized empty latent, positive/negative CLIP text encode, KSampler, VAE decode, and a `SaveImage` node whose `filename_prefix` is the asset id. Load a file in ComfyUI's web UI via **Workflow → Open**, or queue it directly:

```bash
curl -s http://127.0.0.1:8188/prompt -H 'Content-Type: application/json' -d "{\"prompt\": $(cat generated/comfyui-workflows/hub.json)}"
```

`--checkpoint` and `--seed` are optional; adjust the checkpoint name to whatever model you have loaded in ComfyUI, and edit the written JSON directly for anything more specific (LoRAs, samplers, ControlNet).

## 3. Sync renders back into the project

ComfyUI's `SaveImage` node writes `<filename_prefix>_00001_.png`-style files into its own `output/` folder. Pull the newest render per asset id into the project:

```bash
node scripts/assets-sync.mjs --from "C:/path/to/ComfyUI/output"
```

That's a dry run — it reports which asset ids matched a render and which are still missing, without copying anything. Re-run with `--apply` to copy the matched files into `public/assets/generated/<id>.<ext>`:

```bash
node scripts/assets-sync.mjs --from "C:/path/to/ComfyUI/output" --apply
```

## 4. Wire a generated asset into the UI

Once a render lands in `public/assets/generated/`, point the relevant `background`/`portrait` field at it (in a pack JSON, or in `theme-persona.css` for chrome art) as a deliberate, reviewed edit — the sync step only stages files, it never rewrites content.

## Adding a new asset

Add an entry to `ASSET_MANIFEST` in `packages/assets/manifest.mjs` with a `bg(...)` or `portrait(...)` call, then add a test case in `tests/assets-manifest.test.mjs` asserting its id, kind, and size.

## ComfyUI Venus-style pipeline
`node scripts/comfy-sprites.mjs --check` verifies a running ComfyUI (COMFY_HOST, default 127.0.0.1:8188) has the nodes/models; without `--check` it renders sprites (base → cutout → face pass) and scene CGs from the same character folders as `novelai-sprites.mjs`. Rooms are skipped. Workflows live in `assets/comfy/workflows`.
