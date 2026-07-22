---
name: Pricing engine v2 design decisions
description: Judgment calls made implementing the v2 pricing engine spec (Groq risk scoring, revenue forecast bands, human review) when the user declined to clarify scope.
---

## Groq risk scoring must stay anchored and always have a deterministic fallback
LLM-computed risk scores (1-10) are constrained to within 2 points of the deterministic
heuristic score, and any missing `GROQ_API_KEY` or call failure falls back to the
deterministic score + heuristic factor list (never hard-fails pricing).

**Why:** mirrors the existing convention already used elsewhere in this codebase for
Groq-backed scoring routes (loan scoring, `/agent/score`) — an LLM should refine, not
replace, a workable deterministic baseline for a financial pricing decision.

**How to apply:** if extending pricing/risk logic further, keep this anchor+fallback
shape rather than trusting the LLM output unconstrained.

## Revenue-forecast uncertainty band must be tuned so defaults don't spuriously trigger review
The confidence-interval half-width formula for the low/expected/high revenue forecast
was tuned (`0.08 + weatherRisk*0.20 + ndviVolatility*0.50`, capped 0.08-0.30) so that
*typical*-risk inputs land near a 0.35-0.4 uncertainty ratio — safely under the 0.5
human-review threshold — while genuinely volatile inputs still cross it.

**Why:** an earlier, more generous half-width formula produced ~0.84 uncertainty ratio
even at default risk inputs, so almost every listing tripped the "forecast too wide"
human-review flag, making the flag meaningless noise.

**How to apply:** if the human-review trigger ever needs a new signal or threshold,
sanity-check it against *typical* (not just edge-case) inputs before shipping — a
trigger that always fires is as useless as one that never fires.

## Scope was intentionally cut down from the full v2 spec
Built: Groq-anchored risk score + explainability, confidence-interval revenue forecast,
cold-start capping, human-review trigger, v2 lambda formula with an offtake-correlation
hook. Deliberately deferred (not built): region/farmer/input correlation terms, voucher
redemption tracking, forecast calibration log — each needs new tables or an external
data feed the project doesn't have yet.

**Why:** the user was asked which v2 items to prioritize and declined to answer: rather
than block, the lower-lift/high-value subset was built and the rest explicitly deferred.

**How to apply:** if picking this back up, the deferred items are still spec'd in the
original pricing-engine-v2 spec doc (not in this repo's memory) — check with the user
before assuming they still want them before building new data pipelines for them.
