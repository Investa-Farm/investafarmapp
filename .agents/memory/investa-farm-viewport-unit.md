---
name: Investa Farm mobile viewport unit
description: dvh unit fix, background-scroll-lock approach, and the will-change/transform containing-block trap for the Investa Farm mobile shell.
---

## 100dvh fix
`.app-shell` base rule (unguarded by media query) already uses `100dvh` for the Android-flicker fix; only desktop-only media-query blocks needed the same swap for consistency.

## Background-scroll lock — use CSS `:has()`, not a MutationObserver
The app has ~60 custom hand-rolled modals/sheets (all render a literal `fixed inset-0` overlay div; Tailwind keeps utility class names literal in the DOM, so they're queryable). A JS `MutationObserver` watching `document.body` subtree to detect any open overlay and toggle `body.style.overflow` caused visible scroll jank/stutter across every screen — it re-ran the query on every React re-render, not just modal open/close.

**Why:** any DOM mutation triggers the observer callback, so scroll-driven state updates (headers, lists, counters) re-run the check dozens of times a second, and any transient match forces a reflow at the wrong moment.

**How to apply:** use a pure-CSS rule instead — `body:has(.fixed.inset-0) { overflow: hidden; touch-action: none; }`, gated by `@media (max-width: 820px), (pointer: coarse)` so desktop Chrome is untouched. No JS observer needed; browser handles it natively with no jank. Lives in `src/index.css`.

## `will-change: transform` on a page wrapper traps every `position: fixed` descendant
`.page-enter` (applied to the same root div as `.app-shell` on almost every page) had `will-change: opacity, transform;` for a one-off 0.22s entrance animation. Per the CSS spec, `will-change: transform` creates a containing block for descendant `fixed`/`absolute` elements — identical to actually applying a `transform`. `.app-shell` itself already had a code comment warning against this exact hazard, but the hazard was reintroduced one level down via `will-change`.

**Why:** `BottomNav` (`fixed bottom-0`) and modals like `WalletModal` (`fixed inset-0`) are both rendered as descendants of `.app-shell.page-enter`. Once trapped, `fixed` no longer means "pinned to the viewport" — it means "pinned to the edge of the `.app-shell` box", which can be much taller than the visible screen on a long page. Symptoms: the bottom nav only appears after scrolling all the way down, and full-screen modals/sheets render off-screen or show only a sliver (e.g. just their header) instead of sliding fully into view.

**How to apply:** never put `transform` (or `filter`/`perspective`/`contain` with the relevant values) in a `will-change` list on any ancestor of a `fixed`-position element meant to be viewport-relative. For `.page-enter`, keep only `will-change: opacity;` — the animation still animates `transform` via keyframes, it just isn't hinted, which is an acceptable perf trade-off for a 0.22s one-time transition. If this pattern reappears (a new page wrapper class with `will-change`/`transform`), check it doesn't sit between `.app-shell` and any `<BottomNav>` or modal.
