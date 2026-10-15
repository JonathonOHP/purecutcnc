# Handoff C — issue #1035, correction slice (review round 1 finding)

You are the implementation worker for **correction slice C** of *issue #1035 — Add a
Claude Code provider to integration-manager dispatch*.

Work only in this task worktree: `/Users/frankp/Projects/worktrees/purecutcnc/claude-provider-fix`.
Do not create, remove, merge, push, or switch branches or worktrees. Do not create a
PR. Do not work in the integration checkout or any other repository directory.

Read first: `scripts/issue-1035-c-handoff.md` (this file), `AGENTS.md`,
`scripts/issue-1035-a-handoff.md` (the original slice contract — everything it
requires still holds), and the plan in
`https://github.com/PureCutCNC/purecutcnc/issues/1035`.

## Why this slice exists

Slice A shipped (`7e25636d`, merged as `77059378`) and the read-only Codex reviewer
raised one blocker:

> `Bash(npx tsx *)` in `allowed_tool_list` permits arbitrary JavaScript and
> subprocesses, including writes during review and `git commit`/`git push` during
> implementation. Omitting `Bash(git …)` does not prevent this. Also,
> `--allowedTools` grants approvals rather than restricting the available tool set.

The finding is **correct in substance**. `npx tsx`, `npx eslint` and
`npm run build:gates` execute repository code, so no allow-list of them can be a
sandbox; only the direct `git`/`gh` path is actually closable with permission rules.
The slice therefore made a **false safety claim** in code comments and docs, and left
the direct commit path merely absent rather than denied.

Fix both, without changing the design and without weakening the allow-lists.

## C1. Deny the direct write path — `scripts/run-claude-agent.sh`

- Build a `disallowed_tool_list` and pass it as `--disallowedTools` in **both** modes
  (deny rules take precedence over allow rules). It must at minimum deny the direct
  repository-write path:
  `Bash(git commit)`, `Bash(git commit *)`, `Bash(git add)`, `Bash(git add *)`,
  `Bash(git push)`, `Bash(git push *)`, `Bash(git reset *)`, `Bash(git checkout *)`,
  `Bash(git switch *)`, `Bash(git stash *)`, `Bash(gh)`, `Bash(gh *)`.
  Check the exact flag name and spec syntax against `claude --help` on this machine;
  do not guess.
- Add the flag to `claude_args` for both modes.
- Keep `--permission-mode`, both allow-lists, `--model` handling, artifacts and
  markers exactly as they are. **Do not remove `npx tsx` / `npx eslint` /
  `npm run build:gates` from the allow-lists** — the plan requires them.

## C2. Make every claim say what is actually true

Replace the overclaim everywhere it appears. The accurate statement is:

- `--allowedTools` is an **allow-list, not a sandbox**: it decides only which
  commands run without a prompt in a non-interactive `-p` session.
- The **direct** `git`/`gh` write path is explicitly denied with `--disallowedTools`.
- `npx tsx`, `npx eslint` and `npm run …` execute repository code, so they remain
  general-purpose escape hatches; confinement is **permission-based, not an OS
  sandbox** (unlike the Codex `-s read-only`/`-s workspace-write` and DSH
  `read-only`/`workspace-write` modes, which are real sandboxes).
- The actual guarantee for "the worker cannot commit" is the manager's review of the
  **real diff** plus the fact that a worker commit can never merge itself.

Places to correct (search for the current wording; do not touch anything else):

- `scripts/run-claude-agent.sh` — the header comment, the `allowed_tool_list` /
  `permission_mode` comments, the `usage()` text (line ~42-45 says "implement runs
  acceptEdits with a repository build/test allowlist and leaves edits uncommitted for
  the manager"), and the inline comment at the `manager`-facing prompt.
- `scripts/dispatch-task.sh` — the `usage()` paragraph that says the claude leaf
  "is denied commit-capable tools" (search `denied commit-capable tools`) and the
  `DSH/Claude/Codex commit fallback` paragraph.
- `.agents/skills/manager-delegate/SKILL.md` — the `claude` provider bullet.
- `scripts/INDEX.md` — the `run-claude-agent.sh` bullet.
- `scripts/claude-deepseek-agent-prompt.md` — the commit-ownership rule line, which
  currently says "the permission/sandbox boundary intentionally cannot modify a
  linked worktree's shared Git metadata" for Claude too. For the `claude` provider
  that is not a filesystem boundary; keep the sentence accurate for all three.

Keep every correction short; this is not a rewrite of the docs.

## C3. Test the new behaviour — `scripts/test-claude-agent.sh`

- Assert the fake `claude` sees the denying `--disallowedTools` specs in **review**
  and **implement** argv.
- Keep asserting the allow-list contains no commit-capable command spec.
- Keep every existing assertion green, and keep `printf 'test-claude-agent: passed\n'`.

## Allowed files

```
scripts/run-claude-agent.sh
scripts/test-claude-agent.sh
scripts/dispatch-task.sh
scripts/test-dispatch-task.sh          (only if a changed string forces it)
scripts/INDEX.md
.agents/skills/manager-delegate/SKILL.md
scripts/claude-deepseek-agent-prompt.md
```

## Forbidden files

Everything else. No `src/**`, no `package.json`, no `AGENTS.md`, no `.github/**`, no
other leaf launcher or harness, no new files, and **do not touch
`scripts/issue-1035-a-handoff.md`, `scripts/issue-1035-c-handoff.md` or
`scripts/issue-1035-review-handoff.md`**.

## Required invariants

- `--provider claude` still works in both modes; `claude-deepseek`, `dsh`, `codex`
  and the `claude-deepseek` default are unchanged.
- Credential scrubbing, `--model` handling, `.final.md`/`.session`/`.ndjson`
  artifacts, progress markers, manager-commit ownership and exit-code propagation are
  all unchanged.
- No documentation sentence claims more confinement than the code delivers.
- No Co-Authored-By lines, no generated-by footers.

## Required checks

```
bash -n scripts/run-claude-agent.sh scripts/dispatch-task.sh \
        scripts/test-claude-agent.sh scripts/test-dispatch-task.sh
scripts/test-claude-agent.sh
scripts/test-dispatch-task.sh
scripts/test-codex-agent.sh
scripts/test-dsh-agent.sh
scripts/test-claude-deepseek-agent.sh
claude --help | grep -n 'disallowedTools' || echo 'FLAG MISSING'
claude --help | grep -n 'allowedTools'
grep -rn 'denied commit-capable tools' scripts .agents || echo 'overclaim gone'
```

Do **not** run the real `claude` binary. Do not install `node_modules` (the
dispatcher's gate installs and runs it). If `node_modules` is already present, run
`scripts/build-summary.sh` once and report the result.

## Finish with exactly this block

```
STATUS: complete | blocked
COMMIT: none
CHANGED_FILES: <comma-separated paths>
CHECKS: <each command and pass/fail result>
RISKS: <none or concise unresolved risks>
```
