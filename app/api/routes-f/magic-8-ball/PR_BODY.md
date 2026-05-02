# feat: magic 8-ball API with stats tracking

Implements the magic 8-ball endpoint at `app/api/routes-f/magic-8-ball/`.

## Endpoints

- `POST /api/routes-f/magic-8-ball` — accepts `{ question }`, validates length (3–500 chars), returns a random answer with category
- `GET /api/routes-f/magic-8-ball/stats` — returns `{ total_asks }` reflecting valid POSTs since server start

## File structure

```
app/api/routes-f/magic-8-ball/
├── route.ts
├── stats/route.ts
├── _lib/
│   ├── answers.ts   # all 20 classic answers with categories
│   ├── helpers.ts   # pickRandom, validateQuestion
│   └── types.ts     # Answer, Magic8BallResponse, StatsResponse
└── __tests__/route.test.ts
```

All code is self-contained — zero imports from outside this folder.

## Tests

Vitest unit tests covering:
- All 20 answers reachable via `pickRandom` (10k iterations)
- Categories correctly tagged (10 positive / 5 neutral / 5 negative)
- `total_asks` increments on each valid POST, not on invalid ones
- 400 on missing, too-short, and too-long questions
- Stats endpoint reflects POST count

Closes #<issue-number>
