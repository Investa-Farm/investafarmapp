---
name: Cross-tab storage sync pitfall
description: A `storage` event listener must re-derive state from localStorage, not from the current tab's DOM/state, or the sync silently no-ops.
---

When implementing state that should sync across browser tabs via `window.addEventListener("storage", handler)`, the handler fires in *other* tabs when localStorage changes — never in the tab that made the write (browsers don't fire `storage` on the writer's own tab).

**Why:** it's tempting to write one generic `sync()` function that both the same-tab custom event and the cross-tab `storage` event call, reading current DOM state (e.g. `document.documentElement.classList.contains("dark")`). That works for the same-tab case (DOM was already updated by the toggle action) but is a no-op for the cross-tab case, because the DOM in the *other* tab was never touched — only localStorage changed. The bug is invisible in manual same-tab testing since same-tab custom events mask it.

**How to apply:** give the `storage` listener its own handler that reads the changed value straight from `localStorage` (or `event.newValue`) and applies it to local state/DOM directly, rather than reusing a "read current DOM" helper shared with the same-tab sync path.
