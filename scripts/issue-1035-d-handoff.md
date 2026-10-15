# Handoff D — issue #1035, wording slice (review round 2 finding)

You are the implementation worker for **wording slice D** of *issue #1035 — Add a
Claude Code provider to integration-manager dispatch*.

Work only in this task worktree: `/Users/frankp/Projects/worktrees/purecutcnc/claude-provider-wording`.
Do not create, remove, merge, push, or switch branches or worktrees. Do not create a
PR. Do not work in the integration checkout or any other repository directory.

This slice changes **prose only**. Not one flag, not one command, not one test
assertion may change. If you find yourself editing behaviour, stop — that is out of
scope.

Read first: `scripts/issue-1035-a-handoff.md` (original slice contract),
`scripts/issue-1035-c-handoff.md` (round-1 correction), `AGENTS.md`, and the plan in
`https://github.com/PureCutCNC/purecutcnc/issues/1035`.

## Why this slice exists

The read-only Codex reviewer accepted that correction slice C wired the deny flag
correctly, and raised one **major** residual:

> `scripts/run-claude-agent.sh:8,17,88` (header, `usage()`, review `allowed_tool_list`),
> verified at `ff32b6e2`, still claims read-only review, worktree-only edits, and
> guaranteed prevention of commits/merges. Allowed `npx tsx` can write files or spawn
> Git/network operations; manager diff review cannot prevent those earlier effects.
> Related wording remains in `scripts/INDEX.md:26` and
> `.agents/skills/manager-delegate/SKILL.md:60`.

It is right about the **headline clauses**. A qualifier now follows each claim, but the
leading sentence still reads as an enforced capability. In review mode `npx tsx` and
`npx eslint` are allow-listed, and in implement mode `npm run build:gates` / `npx tsx`
are, so **both** modes can write files and spawn subprocesses.

## The rule for every sentence you touch

Never state an enforced capability. State, in this order:

1. what the **worker is instructed** to do (obligation), and
2. what the **permission rules** allow or deny, and
3. that the allow-listed build/test commands can still perform arbitrary file writes
   and subprocess work **in both modes**, so confinement is permission-based and not a
   sandbox, and
4. that the manager's review of the **actual diff** is the acceptance gate.

Do not add new caveats beyond this; do not turn the docs into essays. One accurate
sentence replaces each inaccurate one.

## Exact locations to fix

- `scripts/run-claude-agent.sh` — the header block. The first paragraph currently
  reads "Review is read-only; implement edits only inside the worktree and leaves them
  uncommitted for the manager to commit." Rewrite it as the worker's obligation
  ("the worker is instructed to review only, to edit only inside the supplied
  worktree, and to leave its edits uncommitted for the manager"), and make the
  existing "Confinement is permission-based…" paragraph say **both** modes.
- `scripts/run-claude-agent.sh` — `usage()`. "Review runs read-only (plan permission
  mode plus a read-only tool allowlist)" asserts a guarantee; make it the instruction
  plus the permission rules.
- `scripts/run-claude-agent.sh` — the review `allowed_tool_list` comment
  (`# … no edits, no commits, no network writes.`). That trailing clause is the
  sharpest remaining false claim: `npx tsx` is on the list directly above it. Replace
  it with an explicit statement that the allow-listed commands can do those things.
- `scripts/run-claude-agent.sh` — the implement `allowed_tool_list` comment, if it
  still implies edits stay in the worktree.
- `scripts/INDEX.md` — the `run-claude-agent.sh` bullet's "Review is read-only
  (…)".
- `.agents/skills/manager-delegate/SKILL.md` — the `claude` provider bullet's
  "Review uses `--permission-mode plan` with a read-only tool allowlist;
  implementation uses …".
- `scripts/dispatch-task.sh` — `usage()`. Its current wording is close to correct;
  only tighten anything that still reads as "the claude leaf cannot commit".
- `scripts/claude-deepseek-agent-prompt.md` — only if a sentence is now inaccurate;
  otherwise leave it.

Search for the residual phrasings before you finish:

```
grep -rn 'Review is read-only\|no edits, no commits, no network writes\|edits only inside the worktree' scripts .agents
```

That command must come back empty when you are done.

## Allowed files

```
scripts/run-claude-agent.sh
scripts/dispatch-task.sh
scripts/INDEX.md
.agents/skills/manager-delegate/SKILL.md
scripts/claude-deepseek-agent-prompt.md   (only if genuinely inaccurate)
```

## Forbidden files

Everything else — in particular `scripts/test-claude-agent.sh`,
`scripts/test-dispatch-task.sh`, and every other harness; those already pass and must
not be modified to accommodate prose. No `src/**`, no `package.json`, no `AGENTS.md`,
no `scripts/issue-1035-*-handoff.md`.

## Required invariants

- **Zero behavioural change.** The argv the leaf builds (flags, allow-list,
  disallow-list, model handling), artifact paths, markers, exit codes, and the
  `dispatch-task.sh` provider logic are byte-identical.
- All five provider harnesses still pass, unmodified.
- No Co-Authored-By lines, no generated-by footers.

## Required checks

```
bash -n scripts/run-claude-agent.sh scripts/dispatch-task.sh
scripts/test-claude-agent.sh
scripts/test-dispatch-task.sh
scripts/test-codex-agent.sh
scripts/test-dsh-agent.sh
scripts/test-claude-deepseek-agent.sh
grep -rn 'Review is read-only\|no edits, no commits, no network writes\|edits only inside the worktree' scripts .agents
git diff --stat
```

Do **not** run the real `claude` binary. Do not install `node_modules`; the
dispatcher's gate runs `npm run build` afterwards. If `node_modules` is already
present, run `scripts/build-summary.sh` once and report the result.

Because this is prose-only, the diffstat should show comment/help/doc lines only —
report the diffstat and confirm no executable line changed.

## Finish with exactly this block

```
STATUS: complete | blocked
COMMIT: none
CHANGED_FILES: <comma-separated paths>
CHECKS: <each command and pass/fail result>
RISKS: <none or concise unresolved risks>
```
