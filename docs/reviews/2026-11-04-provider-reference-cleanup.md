# Vendor neutral development reference cleanup

Date: 4 November 2026, Asia/Brunei.

The owner requested removal of competitor AI branding from the current codebase. A content and filename scan found the references in development instructions, reviewer metadata, local submission copy and unused local Studio configuration. Application TypeScript, UI copy, model endpoints, migrations and the dependency lockfile had no matching competitor AI brand references.

## Changes

- Replaced development tool and model brand names with accurate generic AI coding assistance and separate AI review descriptions. AI assistance, review findings, uncertainty about reviewer independence and third party attribution remain disclosed.
- Removed five redundant vendor specific instruction pointer files. All project and feature guidance remains in AGENTS.md, with a new rule to keep future companion guidance vendor neutral.
- Replaced workstation specific tool paths with installed skill references and the existing design guidance.
- Removed an unused local Studio assistant credential setting and renamed a commented vector bucket example. No runtime model provider, API endpoint, worker credential or application feature changed.

## Verification

- All 367 remaining existing tracked files, including the dependency lockfile, were scanned for the requested AI competitor names and additional common competing AI brands in both content and filenames. No matches remained. The count excludes the five deleted pointer files and precedes this new report.
- The full repository check passes: lint, formatting, generated route types, strict type checking and **201 tests across 35 files**.
- The edited local service configuration parses successfully; Studio stays enabled on its existing port and application authentication keeps the existing localhost URL.
- `git diff --check` passes. No application source or dependency was modified, so another production build was not needed.

## Boundaries

This is a current working tree cleanup. Existing Git objects, commit history, ignored private evidence, installed third party packages, external tools and the already submitted hackathon entry retain their original content. Those were not rewritten or deleted. This does not claim that the public repository has been updated or that every historical artifact is brand free. No required license or copyright notice was removed. Existing non AI frameworks and infrastructure retain their real names and dependencies.

No commit, push, deployment, external submission update, provider request, credential change or terms acceptance occurred.
