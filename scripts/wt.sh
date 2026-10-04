#!/usr/bin/env bash
# Director workflow helper: one short command per pipeline step, short output (saves director tokens).
#   scripts/wt.sh go 047 codex [role]       new worktree ../sf-wt/T-047 on t-047 + dispatch (codex | bunny)
#   scripts/wt.sh status                   every open worktree: running? report? files changed
#   scripts/wt.sh check 047                full tests (known art failures hidden), diff stat, report Deviations/Questions
#   scripts/wt.sh commit 047 "summary"     commit the worker's changes on t-047
#   scripts/wt.sh int 4 044 045            int-4 worktree merging t-044 t-045; conflicts, tests, validate
#   scripts/wt.sh land 4 044 045           merge int-4 to main, test main, remove worktrees + branches
set -u
ROOT=$(cd "$(dirname "$0")/.." && pwd); WT=$(cd "$ROOT/.." && pwd)/sf-wt; mkdir -p "$WT"
TRAILER="Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
KNOWN='every heroine has the 7 generated|shipped character folders all build|shipped scenes ban minors|every heroine first shows its own CG|failing tests:'
codex(){ ls -t /c/Users/ckx19/AppData/Local/OpenAI/Codex/bin/*/codex.exe 2>/dev/null | head -1; }
oc(){ ls -t /c/Users/ckx19/AppData/Roaming/ai.opencode.desktop/cli/*/opencode-cli.exe 2>/dev/null | head -1; }
tests(){ (cd "$1" && node --test tests/*.test.mjs > "$2" 2>&1); grep -aE '^ℹ (pass|fail)' "$2" | tr '\n' ' '; echo; grep -aE '^✖ ' "$2" | sort -u | grep -avE "$KNOWN" | head -15; }
changed(){ git -C "$1" status --porcelain | grep -v '^ D' | sed 's/^...//' | tr -d '"'; }
case "${1:-}" in
go) t=T-$2; d=$WT/$t; role=${4:-implementer}
  [ -d "$d" ] || git -C "$ROOT" worktree add -q "$d" -b "t-$2" || exit 1
  if [ "$3" = codex ]; then (cd "$d" && nohup "$(codex)" exec -s workspace-write --skip-git-repo-check "Read AGENTS.md, then docs/roles/$role.md, then docs/briefs/$t.md and do it. Use npm.cmd for tests. Write docs/briefs/$t.report.md. Do NOT commit. Reply only with the report." > "$WT/$t.log" 2>&1 &)
  else (cd "$d" && nohup "$(oc)" run --standalone -m "${MODEL:-opencode/space-bunny-free}" "Read AGENTS.md, then docs/roles/$role.md, then docs/briefs/$t.md and do it. Run tests with: node --test tests/*.test.mjs. Write docs/briefs/$t.report.md in the same format the brief asks. Do NOT run git commit. Reply only with the report." > "$WT/$t.log" 2>&1 &); fi
  echo "dispatched $t ($3, $role)";;
status) for d in "$WT"/T-* "$WT"/int-*; do [ -d "$d/.git" ] || [ -f "$d/.git" ] || continue; t=$(basename "$d")
  r=no; [ -f "$d/docs/briefs/$t.report.md" ] && r=yes; n=$(changed "$d" | wc -l)
  log="$WT/$t.log"; age=-; [ -f "$log" ] && age=$(( ($(date +%s) - $(stat -c %Y "$log")) / 60 ))m
  echo "$t report=$r files=$n log-idle=$age last-commit=$(git -C "$d" log -1 --format=%s | cut -c1-50)"; done;;
check) t=T-$2; d=$WT/$t; tests "$d" "$WT/$t.test.txt"; git -C "$d" diff --stat | tail -1; changed "$d" | tr '\n' ' '; echo
  f=$d/docs/briefs/$t.report.md; [ -f "$f" ] && awk '/^#* *(Deviations|Questions|Noticed)/{p=1} p' "$f" | head -40 || echo "no report";;
commit) t=T-$2; d=$WT/$t; mapfile -t F < <(changed "$d"); [ ${#F[@]} -gt 0 ] || { echo "nothing to commit"; exit 1; }
  git -C "$d" add -- "${F[@]}" 2>/dev/null; git -C "$d" commit -q -m "$t: $3" -m "$TRAILER" && git -C "$d" log --oneline -1 | cat;;
int) n=$2; shift 2; d=$WT/int-$n; git -C "$ROOT" worktree add -q "$d" -b "int-$n" || exit 1
  for b in "$@"; do git -C "$d" merge --no-ff -q --no-edit "t-$b" >/dev/null 2>&1 || { echo "CONFLICT merging t-$b:"; git -C "$d" diff --name-only --diff-filter=U; echo "resolve in $d, commit, then rerun the rest by hand"; exit 1; }; echo "merged t-$b"; done
  (cd "$d" && node scripts/reskin-campus.mjs >/dev/null 2>&1); [ -z "$(git -C "$d" diff --ignore-cr-at-eol --stat)" ] && git -C "$d" checkout -q -- . || echo "RESKIN CHANGED FILES: commit them"
  tests "$d" "$WT/int-$n.test.txt"; (cd "$d" && npm run validate 2>&1 | grep -acE '^PASS' | sed 's/^/validate PASS lines: /'; npm run validate 2>&1 | grep -aE '^(FAIL|ERROR)' | head -5);;
land) n=$2; shift 2; cd "$ROOT"; git merge --no-ff -q --no-edit "int-$n" -m "Merge int-$n: $(printf 'T-%s ' "$@")" >/dev/null 2>&1 || { echo "merge failed"; exit 1; }
  tests "$ROOT" "$WT/main.test.txt"; for b in "$@"; do git worktree remove --force "$WT/T-$b" 2>/dev/null; git branch -q -D "t-$b"; done
  git worktree remove --force "$WT/int-$n" 2>/dev/null; git branch -q -D "int-$n"; git log --oneline -1 | cat;;
*) sed -n 2,8p "$0";;
esac
