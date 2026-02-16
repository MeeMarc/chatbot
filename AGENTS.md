# AGENTS.md

This file defines the required workflow for any coding agent working in this repository.

## 1) Non-Negotiable Security Rules

- Never read, print, parse, or inspect secrets.
- Forbidden files and patterns include:
  - `.env`, `.env.*`
  - `*.pem`, `*.key`, `*.p12`, `*.pfx`
  - `id_rsa`, `id_dsa`, `id_ecdsa`, `id_ed25519`
  - any file explicitly labeled as secret, token, credential, or private key
- Do not log or echo secret values to terminal output.
- If a task appears to require a secret, stop and ask the user for a safe redacted placeholder or for them to run that step locally.

## 2) Standard Workflow

1. Understand the request and expected behavior.
2. Inspect only relevant non-secret files.
3. Identify root cause (for bugs) before changing code.
4. Make minimal, targeted edits that preserve existing behavior outside the requested scope.
5. Validate with quick checks (lint, syntax, tests, or focused runtime checks).
6. Summarize what changed, why, and any remaining risks.

## 3) Editing Rules

- Prefer small diffs over broad rewrites.
- Keep function and variable naming consistent with existing code style.
- Avoid introducing unrelated formatting or encoding changes.
- Do not modify unrelated files.
- Add comments only when logic is non-obvious.

## 4) Validation Rules

- Run the narrowest useful validation first.
- If full test execution is heavy, run targeted checks for modified areas.
- If validation cannot be run, state exactly what was not verified.

## 5) Git Safety

- Never run destructive git commands unless explicitly requested.
- Do not revert user changes you did not make.
- If unexpected external changes appear, pause and ask how to proceed.

## 6) Communication Rules

- Be concise and explicit.
- Report concrete file paths changed.
- Call out assumptions and blockers early.
- Provide next-step options only when useful.
