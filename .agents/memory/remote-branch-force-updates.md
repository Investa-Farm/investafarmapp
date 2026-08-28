---
name: Remote branch force updates
description: How to preserve local work when the GitHub main branch has been force-rewritten.
---

When `origin/main` is force-updated and local history becomes unrelated, do not merge or rebase blindly. Preserve the local branch and uncommitted work first, then align `main` with the remote branch if the user asked for the remote state.

**Why:** A force-rewritten branch can produce add/add conflicts across nearly every project file; a normal pull cannot safely reconcile those histories automatically.

**How to apply:** Create a backup branch, stash uncommitted changes, abort any failed rebase, and only then reset the requested branch to `origin/main`. Tell the user exactly where preserved local work remains.