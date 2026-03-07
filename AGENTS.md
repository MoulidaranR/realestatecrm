# Repository Guidelines

## Project Structure & Module Organization
This repository currently contains a lightweight frontend prototype:

- `sparkle_dashboard/index.html`: main single-page dashboard UI (HTML, inline Tailwind config, inline JS/CSS).
- `sparkle_dashboard/dashboard_screenshot.png`: visual reference for the dashboard.
- `real estate crm only.md`: product and domain notes for the broader CRM direction.

Keep new UI assets close to `sparkle_dashboard/` (for example, `sparkle_dashboard/assets/` for images/icons and `sparkle_dashboard/styles/` if CSS is split out later).

## Build, Test, and Development Commands
No package-based build system is configured yet. Use a static server for local development:

- `cd sparkle_dashboard`
- `python -m http.server 5500`

Then open `http://localhost:5500`.  
If Node tooling is added later, document scripts in `package.json` and mirror them here.

## Coding Style & Naming Conventions
- Use semantic HTML5 sections (`header`, `main`, `aside`, etc.) and keep accessibility attributes (`alt`, readable button text) intact.
- Use 2-space indentation in HTML/CSS/JS for consistency in future edits.
- Prefer clear, lowercase kebab-case names for new files (example: `lead-summary-card.html`).
- Keep Tailwind utility groups readable: layout -> spacing -> color -> state.
- For JavaScript, use descriptive camelCase names (example: `toggleDarkMode`).

## Testing Guidelines
There is no automated test suite yet. Before submitting changes:

- Run the page locally and verify layout on desktop and mobile widths.
- Check dark-mode toggle behavior and core interactions in Chromium and Firefox.
- Confirm there are no console errors.

When tests are introduced, place them under `tests/` or beside components with a `.test.*` suffix.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so follow Conventional Commits:

- `feat: add lead activity chart section`
- `fix: correct mobile sidebar overflow`

PRs should include:

- A short scope summary and impacted files.
- Before/after screenshots for UI changes.
- Linked issue/task ID when available.
- Manual verification notes (browsers, viewport sizes, dark/light mode checks).
