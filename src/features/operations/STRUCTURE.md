Feature contract

- `template.html` -> contains root nodes and IDs used by `index.js` (e.g., `#ops-list`).
- `styles.css` -> feature-specific styles, imported by the SPA.
- `index.js` -> exports `init(mount, State)` which mounts UI and returns `{destroy}`.

Data: Fetch from `/api/operations` (GET).

RBAC:

- Add `ALLOWED_ROLES` to `index.js` to define who can access this feature; the router will still lazy-load the module, but `init` should render a friendly 403 when access is denied.
