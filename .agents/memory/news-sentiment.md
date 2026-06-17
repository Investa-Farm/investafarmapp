---
name: News API chain + Crop Sentiment
description: Multi-source news API priority chain, Bluesky social, Groq sentiment analysis per crop, sentiment_scores DB table, UI display.
---

## News source priority (routes/news.ts)
TheNewsAPI (THENEWSAPI_TOKEN) → Currents (CURRENTS_API_KEY) → GNews (GNEWS_API_KEY) → Mediastack (MEDIASTACK_API_KEY) → Google News RSS → STATIC_NEWS

Keys saved to shared env: GNEWS_API_KEY=f315af117cadae7bef4c9f1d4373a9bf, MEDIASTACK_API_KEY already set.
Keys NOT yet provided by user: THENEWSAPI_TOKEN, CURRENTS_API_KEY (slots are in code, just needs env var).

## Bluesky social
Uses `https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=...` — no auth key required.
Fetches 2 queries ("Kenya farming", "Kenya maize") and extracts post text for sentiment input.

## Sentiment (computeNewsSentiment + buildFallbackSentiment)
- Calls Groq `llama-3.3-70b-versatile` with batched article + social text (up to 40 items)
- Prompt asks for `{ "crops": [...] }` JSON object with scores -100 to +100
- Parses `obj.crops` → mapped to SentimentResult[]
- Fallback: `buildFallbackSentiment(articles)` — BASE_SENTIMENT map for 8 Kenya crops + article scan
- BASE_SENTIMENT always returns at least 8 crops even without Groq; real Groq call returns more
- Result cached in `sentimentCache` (2hr); also persisted to `sentiment_scores` table via `persistSentiment()`

## DB: sentiment_scores table
- Fields: cropType, region, score, positivePct, negativePct, neutralPct, volume, keyphrases[], source, snapshotDate, createdAt
- Pushed June 2026; uses onConflictDoNothing (multiple records per crop per day are OK)
- Query in GET /api/news/sentiment: selects today's rows ordered by createdAt desc

## API endpoints
- GET /api/news — priority chain result; kicks off async sentiment analysis as side effect
- GET /api/news/sentiment — in-mem cache → DB today → fresh Groq compute

## Frontend display
- market/index.tsx: `sentimentData` query (staleTime 2hr, no auth needed)
- Rendered as horizontal scrollable strip below category filter in the "news" section
- Shows crop name, score, trend bar, bullish/bearish/neutral label with color coding
- sentimentData query key: `["news-sentiment"]`

**Why:** User specified Bluesky as free X alternative + GNews/Currents/TheNewsAPI as primary news sources. MongoDB was rejected — using existing PostgreSQL for sentiment_scores storage.
