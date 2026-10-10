---
name: GitHub remote authentication
description: Use Replit's secure GitHub authentication path for shell pushes without exposing credentials.
---

**Rule:** Never put a GitHub token in chat, source control, shell history, or logs. If the GitHub integration is not authenticating a shell push, use the `GIT_URL` secret flow and keep the value out of output.

**Why:** The GitHub integration can report healthy while a workspace shell push still fails authentication; Replit's documented private-repository fallback is a repository URL stored as a secret.

**How to apply:** Check for an existing `GIT_URL` secret first. If missing, request it through Replit Secrets. Use it only for the push, then verify the remote commit without printing the secret or credential-bearing URL.
