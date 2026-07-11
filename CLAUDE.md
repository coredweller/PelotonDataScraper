# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run `src/index.ts` directly via `tsx` (no build step)
- `npm run build` — compile TypeScript to `dist/` via `tsc`
- `npm start` — run the compiled output (`node dist/index.js`)

There is no test suite or linter configured yet.

## Architecture

This is a minimal TypeScript/Node project scaffold (ESM, strict mode, NodeNext module resolution). All source lives in `src/`; compiled output goes to `dist/` (gitignored). There is currently only a single entry point, `src/index.ts` — no other structure has been established yet.

## Agents, Skills & Rules

Sourced from `F:/Projects/AI/ClaudeCore`:

- `.claude/agents/typescript-expert.md` — TypeScript/Node expert agent
- `.claude/skills/typescript-api/` — TypeScript/Node conventions, patterns, and reference docs; load this skill when writing TypeScript
- `.claude/rules/` — always-loaded shared rules: `core-behaviors.md`, `code-standards.md`, `verification-and-reporting.md`, `leverage-patterns.md`. Precedence when rules conflict: `core-behaviors` > `code-standards` > `verification-and-reporting` > `leverage-patterns`.
