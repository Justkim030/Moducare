Feature contract for Finance & Billing

- `template.html` -> main DOM
- `styles.css` -> optional CSS
- `index.js` -> may export `init(mount, State)` or render(container)

Data: GET `/api/finance` returns records for the module.

RBAC:

- Define `ALLOWED_ROLES` in `index.js` to list roles allowed to access finance features. The module's `init` will show a 403 message when the current `State.getUser()` lacks permission.
