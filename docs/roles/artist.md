# Role: Artist
Generate CGs and portraits with the repo's art scripts and the owner's local ComfyUI (127.0.0.1:8188). The art spec is in `art/` (e.g. `art/cg/campus.json`).
- Never remove the global underage negatives. Follow each CG's own negatives and hair notes.
- Output into the asset folders named in the ticket (these are gitignored: don't commit images).
- Report: the files produced and the seeds used, plus any off-model results to redo.
