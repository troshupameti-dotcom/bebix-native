# Bebix Development Rules

## Context Usage

- Do NOT scan the entire repository for normal requests.
- Only inspect files directly relevant to the user's request.
- Read dependency files only when necessary.
- Do not inspect unrelated folders.
- Do not perform a full codebase audit unless explicitly requested.
- For small changes, identify the minimum files required.
- Use targeted search instead of reading large directories.
- Keep context usage as low as possible.

## Editing Rules

- Make only the requested changes.
- Do not refactor unrelated code.
- Do not change architecture unless explicitly requested.
- Do not create unnecessary files.
- Do not modify unrelated components.
- After editing, check only the relevant files.

## Project

Bebix is a React Native + Expo + TypeScript application.

Main technologies:
- React Native
- Expo
- Expo Router
- TypeScript
- Supabase
- NativeWind

## Important

Never explore the entire Bebix repository unless I explicitly say:

"Analyze the whole project."

For normal requests:
1. Find the relevant file.
2. Read only that file.
3. Read direct dependencies only if needed.
4. Make the requested change.
5. Avoid unrelated exploration.