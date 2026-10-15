# Handoff E — issue #1035, make `dsh` the default provider

You are the implementation worker for **slice E** of *issue #1035 — Add a Claude Code
provider to integration-manager dispatch*.

Work only in this task worktree: `/Users/frankp/Projects/worktrees/purecutcnc/claude-provider-default`.
Do not create, remove, merge, push, or switch branches or worktrees. Do not create a
PR. Do not work in the integration checkout or any other repository directory.

Read first: `scripts/issue-1035-a-handoff.md`, `scripts/issue-1035-c-handoff.md`,
`AGENTS.md`, and the plan in
`https://github.com/PureCutCNC/purecutcnc/issues/1035`.

## Why this slice exists

Issue #1035 left one decision open in its plan:

> `claude-deepseek` stays as it is (still the default only if Frank wants; otherwise
> make `dsh` the default and say so in the help).

Frank chose **`dsh` becomes the default**. This slice makes exactly that change and
nothing else. Everything else about all four providers stays as it is.

## E1. `scripts/dispatch-task.sh`

- Change the initial provider from `claude-deepseek` to `dsh`
  (currently `provider="claude-deepseek"`).
- Update the `--provider NAME` line in `usage()` so the default is stated on `dsh`
  rather than `claude-deepseek`. Keep the existing option order to keep the diff
  small: `claude-deepseek, claude, dsh (default), or codex`.
- Keep the `--provider must be claude-deepseek, claude, dsh, or codex: $provider`
  error text **unchanged** — a harness asserts that exact string.
- Do not change `DEFAULT_BASE`, the `--model` rule, the manager-commit fallback,
  the credential handling, or any per-provider behaviour. In particular the
  `if [[ "$provider" == "claude-deepseek" ]]` branches must keep working for an
  explicit `--provider claude-deepseek`.

## E2. `scripts/INDEX.md`

Its `dispatch-task.sh` bullet currently opens "`claude-deepseek` remains the default
provider; select `--provider claude` for …, `--provider dsh` for DeepSeek Harness or
`--provider codex` for Codex CLI." Rewrite so it says `dsh` is the default and keeps
all four providers discoverable, including the legacy credential-backed
`claude-deepseek`.

## E3. `.agents/skills/manager-delegate/SKILL.md`

Move the "(the default)" marker: remove it from the `claude-deepseek` bullet and put
it on the `dsh` bullet. Do not restructure the bullets.

## E4. `scripts/test-dispatch-task.sh`

The first test is titled "omitted provider preserves the Claude/DeepSeek dispatch
path" and asserts the fake `claude` output. With the default changed it must assert
the **DSH** path instead:

- omitted provider → the fake `dsh` runs: assert `provider=dsh sandbox=<read-only>`,
  `<--profile>` and `<headless>`. Note the `dsh` mock does not echo stdin, so do not
  assert the prompt text there.
- Keep a **separate, explicit** `--provider claude-deepseek` test that preserves the
  old assertions (`provider=claude`, `<--permission-mode>`, `<plan>`, and the prompt
  text reaching the mock), so the legacy path stays covered.
- Retitle the first test so it says what it now checks.
- Leave every other assertion in the file alone.

## Allowed files

```
scripts/dispatch-task.sh
scripts/test-dispatch-task.sh
scripts/INDEX.md
.agents/skills/manager-delegate/SKILL.md
```

## Forbidden files

Everything else — including `scripts/run-claude-agent.sh`,
`scripts/run-claude-deepseek-agent.sh`, `scripts/run-dsh-agent.sh`,
`scripts/run-codex-agent.sh`, every other harness, `scripts/issue-1035-*-handoff.md`,
any `src/**`, and `package.json`.

## Required invariants

- An explicit `--provider` still selects exactly that provider for all four values.
- Omitted `--provider` selects `dsh`.
- No other behaviour, flag, message or artifact path changes.
- No Co-Authored-By lines, no generated-by footers.

## Required checks

```
bash -n scripts/dispatch-task.sh scripts/test-dispatch-task.sh
scripts/test-dispatch-task.sh
scripts/test-claude-agent.sh
scripts/test-codex-agent.sh
scripts/test-dsh-agent.sh
scripts/test-claude-deepseek-agent.sh
grep -rn 'claude-deepseek (default)\|claude-deepseek remains the default' scripts .agents || echo 'old default wording gone'
grep -n 'provider="dsh"' scripts/dispatch-task.sh
```

Do **not** run the real `claude` binary. Do not install `node_modules`; the
dispatcher's gate runs `npm run build` afterwards. If `node_modules` is already
present, run `scripts/build-summary.sh` once and report the result.

## Finish with exactly this block

```
STATUS: complete | blocked
COMMIT: none
CHANGED_FILES: <comma-separated paths>
CHECKS: <each command and pass/fail result>
RISKS: <none or concise unresolved risks>
```
