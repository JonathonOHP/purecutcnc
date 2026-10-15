# Handoff B — issue #1035, read-only review of slice A

You are the **reviewer** for slice A of *issue #1035 — Add a Claude Code provider to
integration-manager dispatch*.

This is a **read-only review**. Do not edit, stage, commit, or revert anything. Do not
create branches or worktrees. Report findings; the manager owns the fix.

Worktree to review: `/Users/frankp/Projects/worktrees/purecutcnc/claude-provider-impl`
Review target: the whole slice diff versus its base branch:

```
cd /Users/frankp/Projects/worktrees/purecutcnc/claude-provider-impl
git log --oneline feat/issue-1035-claude-provider..HEAD
git diff feat/issue-1035-claude-provider...HEAD
```

Read first: `AGENTS.md` (§ Workflow, § Git & Branching, § Coding Standards),
`scripts/INDEX.md`, `.agents/skills/manager-delegate/SKILL.md`, the plan in
`https://github.com/PureCutCNC/purecutcnc/issues/1035` (`gh issue view 1035`), and
`scripts/issue-1035-a-handoff.md` — the handoff that specified this slice. The
handoff is the contract; the issue is the plan.

## What this slice must be

A new `claude` provider in the integration-manager dispatch flow that uses the Claude
Code CLI with **its own login** (never `.env.agent`, never a DeepSeek/OpenRouter
endpoint). Four deliverables: `scripts/run-claude-agent.sh`, `--provider claude` wiring
in `scripts/dispatch-task.sh`, a mocked harness `scripts/test-claude-agent.sh`, and
docs. Tooling only — a single `src/` byte changed is a blocker.

The closest shipped analogue is the `codex` provider added by #1017
(`scripts/run-codex-agent.sh`, commit `68de387f`). Any divergence from that pattern
must be deliberate and explainable; unexplained divergence is a finding.

## Do not trust the report — verify

Re-run every check yourself from the worktree. The worker's completion block is a
report, not acceptance. Specifically:

1. `bash -n` on every touched `.sh`, then run all five harnesses:
   `scripts/test-claude-agent.sh`, `scripts/test-dispatch-task.sh`,
   `scripts/test-codex-agent.sh`, `scripts/test-dsh-agent.sh`,
   `scripts/test-claude-deepseek-agent.sh`.
   `test-codex-agent.sh` asserts an exact 8-argument Codex argv — confirm the new
   provider did not disturb it.
2. **Credential isolation must be proven, not read.** With
   `DEEPSEEK_AGENT_ENV_FILE`, `DEEPSEEK_API_KEY`, `ANTHROPIC_BASE_URL` and
   `ANTHROPIC_AUTH_TOKEN` all exported by the caller, capture what the fake `claude`
   actually sees. An unset-only-in-a-comment is not isolation.
3. **Provider selection.** Confirm `--provider claude` really executes the new leaf in
   both implement and review mode, and that `claude-deepseek`, `dsh`, `codex` and the
   **default provider** are unchanged. A `case` arm that falls through to another
   leaf, or a `--provider` error message that omits `claude`, is a blocker.
4. **Manager-commit fallback.** Confirm `claude` joined the shared manager-commit path
   (one commit after zero exit with changes; none after failure; none when clean), and
   that a real `git commit`/`git push`/`gh` is impossible for the implement worker —
   check the `--allowedTools` allowlist is genuinely restrictive (no `Bash(*)`, no
   `bypassPermissions`, no `--dangerously-skip-permissions`).
5. **Review is read-only.** Is `--permission-mode plan` + a read-only `--allowedTools`
   list sufficient in a non-interactive `-p` run? Look for any hole where an
   un-allowlisted tool would proceed rather than fail closed.
6. **Never-read `.env.agent`.** `grep -n 'env.agent\|DEEPSEEK\|ANTHROPIC_BASE_URL\|
   ANTHROPIC_AUTH_TOKEN\|ANTHROPIC_API_KEY' scripts/run-claude-agent.sh
   scripts/dispatch-task.sh` and confirm nothing reads or sets a DeepSeek credential or
   endpoint.
7. **Session resumability.** The leaf must not pass `--no-session-persistence`; confirm
   `FILE.session` is really a resumable id and `.final.md` is the result text.
8. **Flag reality.** Run `claude --help` and check every flag the leaf passes actually
   exists in Claude Code 2.1.206 — in particular that no invented `--max-turns` (or any
   other imagined flag) is passed blind, and that `--model` is omitted when no model is
   requested and `CLAUDE_AGENT_MODEL` is honoured.
9. **Stale enumerations.** `grep -rn 'claude-deepseek, dsh, or codex\|claude-deepseek|dsh|codex'
   scripts .agents` — every provider list, help string, error message and SKILL.md
   command block must now include `claude`. Conversely confirm the docs do not claim
   behaviour the code does not have (e.g. a "weekly limit" note vs. what the leaf does).
10. **Docs + index maintenance.** `scripts/INDEX.md` must register both new files;
    `.claude/skills/manager-delegate` is a **symlink** to
    `.agents/skills/manager-delegate`, so exactly one `SKILL.md` may exist — a second
    real copy is a finding.
11. **Mutation-check the load-bearing assertions.** With a `cp` backup (never
    `git checkout`), break each of these one at a time and confirm a harness goes red,
    then restore: (a) delete the `claude` arm from the `--provider` `case`;
    (b) drop `claude` from the manager-commit condition; (c) remove the child-env scrub
    of `DEEPSEEK_*`. Report each result — a harness that stays green is the finding.

## Report format

Findings first, most severe first. Each finding: severity
(`blocker` / `major` / `minor` / `nit`), `file:line` (line numbers are a hint — cite the
symbol or function name too), what is wrong, and the concrete fix. Then state, in one
or two sentences, whether the slice is acceptable as-is.

Be adversarial but do not invent work: a personal preference is a `nit` at most, and if
the diff is clean, say so plainly. Do not propose scope beyond issue #1035.

Finish with exactly this block:

```
STATUS: complete | blocked
COMMIT: none
CHANGED_FILES: none
CHECKS: <each command you ran and its real pass/fail result>
RISKS: <none or the unresolved risks that remain for the manager>
```
