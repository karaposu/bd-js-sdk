# Crawl API — design for the JS SDK

This is a design proposal for adding the Bright Data Crawl API to `@brightdata/sdk`. The Python SDK already has it (`brightdata.crawler`), and the wire protocol is shared with the existing platform scrapers — so most of the work is reuse, not new code.

The goal of this doc is to lock in the JS surface and the reuse-vs-new decisions before writing any code.

## What the Crawl API actually is

One dataset (`gd_m6gjtfmeh43we6cqc`), four endpoints, two flavors of the same operation:

| Endpoint | Method | Purpose |
|---|---|---|
| `/datasets/v3/scrape` | POST | Sync — send URLs, get inline result in one round-trip. |
| `/datasets/v3/trigger` | POST | Async — send URLs, get `{snapshot_id}` back. |
| `/datasets/v3/progress/{snapshot_id}` | GET | Poll status until terminal. |
| `/datasets/v3/snapshot/{snapshot_id}` | GET | Fetch the data once ready. |

Body shape on both POSTs:

```json
{"input": [{"url": "https://example.com"}, {"url": "https://example.com/1"}]}
```

Query parameters used today: `dataset_id`, `notify=false`, `include_errors=true|false`. Each output record carries every requested format bundled (`url`, `markdown`, `html2text`, `page_html`, …).

These are **the same four endpoints already used by the platform scrapers** (LinkedIn, Amazon, etc.) — they're shared infrastructure in the Datasets v3 backend. The Crawler is just another `dataset_id` against them.

## Mapping to the existing JS SDK

The JS SDK already speaks all four endpoints. The relevant pieces:

| Need | Already exists in JS SDK |
|---|---|
| POST `/datasets/v3/scrape` | `BaseAPI.run({async: false})` in `src/api/scrape/base.ts` |
| POST `/datasets/v3/trigger` | `BaseAPI.run({async: true})` in `src/api/scrape/base.ts` |
| GET `/datasets/v3/progress/{id}` | `SnapshotAPI.getStatus()` in `src/api/scrape/snapshot.ts` |
| GET `/datasets/v3/snapshot/{id}` | `SnapshotAPI.fetch()` / `.download()` in `src/api/scrape/snapshot.ts` |
| Polling loop | `pollUntilReady` in `src/utils/polling.ts`, `Deadline` in `src/utils/deadline.ts` |
| Snapshot-backed job handle | `ScrapeJob` in `src/api/scrape/job.ts` (generic over any `SnapshotOperations`; has `status()`, `wait()`, `fetch()`, `toResult()`, `cancel()`) |
| Result base class | `BaseResult<T>` in `src/models/result.ts` |
| URL validation | `URLParamSchema` in `src/schemas/client.ts` (accepts `string` or `string[]`, requires `httpUrl`) |
| HTTP / retry / rate-limit / auth | `Transport` in `src/core/transport.ts` |
| Response shape validation | `SnapshotMetaResponseSchema` in `src/schemas/responses.ts` |

So the crawler is a thin façade over infrastructure that's already there — plus one new value type (`CrawlResult`) following the established pattern.

## Recommended JS surface

Top-level on `bdclient`, named `crawler`. Peer of `scrape`, `search`, `datasets`, `scraperStudio`, `browser`. Matches the Python SDK exactly (`brightdata.crawler` ↔ `bdclient.crawler`), so docs and porting examples carry over.

```ts
client.crawler.crawl(urls, opts?)             // sync /scrape  → CrawlResult
client.crawler.trigger(urls, opts?)           // async /trigger → ScrapeJob (aliased as CrawlJob)
client.crawler.status(snapshotId)             // GET /progress  → status string
client.crawler.download(snapshotId, opts?)    // poll + fetch  → CrawlResult
```

Example flows:

```ts
import { bdclient } from '@brightdata/sdk';

await using client = new bdclient();

// Sync — single round-trip
const res = await client.crawler.crawl('https://example.com');
console.log(res.data?.[0]?.markdown);

// Sync — batch
const batch = await client.crawler.crawl([
    'https://example.com',
    'https://example.com/about',
]);
console.log(`${batch.pageCount} pages, ${batch.elapsedMs()}ms`);

// Async — manual lifecycle, then convert back to a CrawlResult
const job = await client.crawler.trigger([url1, url2]);
console.log(await job.status());
const result = await client.crawler.download(job.snapshotId);

// Async — by snapshot_id (e.g. resuming from logs)
const status = await client.crawler.status('s_xyz...');
const result = await client.crawler.download('s_xyz...');
```

Note: calling `job.toResult()` directly on the returned job is also valid, but returns a `ScrapeResult` (because `ScrapeJob` is generic — see "What to reuse" below). When you want a `CrawlResult`, route through `client.crawler.download(snapshotId)`.

### Why `crawler` and not `crawl` or `scrape.crawler`

- **`crawler` (top-level)** — matches Python (`client.crawler.*`), reads naturally as a noun, leaves room for future verbs (`map`, `extract`) under the same namespace. **Recommended.**
- `client.crawl()` (verb on the client) — shortest but flat; awkward when you want both `crawl()` and `trigger()`; doesn't match Python.
- `client.scrape.crawler.*` — incorrect grouping; the Crawl API is not a per-platform scraper, it's a general primitive that takes arbitrary URLs.

## What to reuse, what to mint new

This is the key design call. Two distinct decisions:

### Reuse `ScrapeJob` (alias as `CrawlJob`)

`ScrapeJob` (`src/api/scrape/job.ts`) is misnamed — despite living under `api/scrape/`, it's a **generic wrapper around any snapshot-backed async job**. Its constructor takes a `SnapshotOperations` interface, not a platform-specific dependency:

```ts
constructor(
    snapshotId: string,
    snapshotOps: SnapshotOperations,
    options?: { platform?: string; triggeredAt?: Date },
)
```

The `platform` field is just a display tag, settable per call. Its `status()`, `wait()`, `fetch()`, `download()`, `cancel()`, and `toResult()` methods all delegate through the `SnapshotOperations` interface — they work for crawler jobs identically.

So the JS crawler should reuse `ScrapeJob` directly and re-export it as `CrawlJob` (a type alias) for porters coming from Python:

```ts
// src/api/crawler/index.ts
export { ScrapeJob as CrawlJob } from '../scrape/job';
```

`CrawlJob` and `ScrapeJob` are the same class. Python only ships a value-only `CrawlJob` because Python doesn't have the methods-on-job pattern; in JS the methods already exist on the generic version.

One cost of aliasing rather than subclassing: `job.toResult()` returns `ScrapeResult`, not `CrawlResult`. Users who want a `CrawlResult` from a job should route through `client.crawler.download(job.snapshotId)` (which calls `toResult` internally and adapts the result). The example flows above use this pattern. If we ever decide the type mismatch is too noisy, the fix is a thin subclass that overrides `toResult` — but right now it would be ~25 LOC of class for one method return type.

### Mint a new `CrawlResult` class

Unlike `ScrapeJob`, the Result class should not be reused. Two reasons:

1. **The Python parallel.** Python has a dedicated `CrawlResult` dataclass with crawler-specific fields like `page_count`.
2. **The JS SDK's own convention.** The SDK already follows a one-Result-subclass-per-service pattern: `ScrapeResult`, `SearchResult` (both in `src/models/result.ts`), `DiscoverResult` (in `src/api/discover/result.ts`). All extend `BaseResult<T>`. Reusing `ScrapeResult` for the crawler would break that convention without saving meaningful code — `CrawlResult` is ~30 LOC of subclass.

So `CrawlResult` is a new class, modeled after `DiscoverResult` (the most recently added of the existing Result subclasses, and the closest pattern match — defined in its own service folder, not in `src/models/`).

| Field | Type | Notes |
|---|---|---|
| `success` | `boolean` | from `BaseResult` |
| `data` | `CrawlRecord[] \| null` | from `BaseResult<CrawlRecord[]>` |
| `error` | `string \| null` | from `BaseResult` |
| `cost` | `number \| null` | from `BaseResult` (unused by crawler, left null) |
| `triggerSentAt` | `Date \| null` | from `BaseResult` |
| `dataFetchedAt` | `Date \| null` | from `BaseResult` |
| `pageCount` | `number \| null` | **new** — mirrors Python's `page_count` |
| `snapshotId` | `string \| null` | **new** — null on sync path, set on async path |

Per-record `CrawlRecord` typing is opt-in — all fields optional, open-ended:

```ts
export interface CrawlRecord {
    url?: string;
    markdown?: string;
    html2text?: string;
    page_html?: string;
    [key: string]: unknown;
}
```

### Error contract — `crawl()` and `download()` never throw

Match the Python contract and the JS SDK's existing `orchestrate()` / `toResult()` pattern:

- **Validation errors raise** (`ValidationError`) — always.
- **HTTP / network errors land in `CrawlResult({ success: false, error })`** for `crawl()` and `download()`. Callers branch on `.success` — same idiom used everywhere else in the SDK.
- **`trigger()` raises `APIError` / `ValidationError`** — it has nothing to wrap a failure into (returns a `ScrapeJob`, not a Result). Matches Python's `trigger()` semantics.
- **`status()` raises `APIError` / `ValidationError`** — single-shot probe; no Result to wrap into.

## Files to add

```
src/api/crawler/
    service.ts        ← CrawlerService class
    result.ts         ← CrawlResult class + CrawlRecord type
    index.ts          ← public re-exports (CrawlerService, CrawlResult, CrawlJob alias)

src/schemas/
    crawler.ts        ← CrawlOptionsSchema, CrawlDownloadOptionsSchema

tests/
    crawler.test.ts   ← unit + integration coverage
```

Five files, all small. `CrawlResult` lives at `src/api/crawler/result.ts` (mirroring `DiscoverResult`'s location), not in `src/models/result.ts` — `models/` is reserved for the older Scrape/Search results that were defined before the service-folder pattern took hold.

## Files to edit

- `src/client.ts` — add lazy `crawler` getter alongside the existing ones.
- `src/index.ts` — export `CrawlerService`, `CrawlResult`, `CrawlJob`, plus the related types.

That's it. No subpath build, no `package.json` edits, no `rollup.config.js` edits. Discover doesn't have a subpath either — same pattern, same scope.

## Implementation sketch

### `src/api/crawler/result.ts`

```ts
import { BaseResult, type BaseResultFields } from '../../models/result';

export interface CrawlRecord {
    url?: string;
    markdown?: string;
    html2text?: string;
    page_html?: string;
    [key: string]: unknown;
}

export interface CrawlResultFields extends BaseResultFields<CrawlRecord[]> {
    pageCount?: number | null;
    snapshotId?: string | null;
}

export class CrawlResult extends BaseResult<CrawlRecord[]> {
    readonly pageCount: number | null;
    readonly snapshotId: string | null;

    constructor(fields: CrawlResultFields) {
        super(fields);
        this.pageCount = fields.pageCount ?? null;
        this.snapshotId = fields.snapshotId ?? null;
    }

    override toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            pageCount: this.pageCount,
            snapshotId: this.snapshotId,
        };
    }

    override toString(): string {
        const base = super.toString();
        const sid = this.snapshotId
            ? ` snapshot_id=${this.snapshotId.slice(0, 12)}...`
            : '';
        const pages = this.pageCount != null ? ` pages=${this.pageCount}` : '';
        return `<CrawlResult ${base}${pages}${sid}>`;
    }
}
```

### `src/schemas/crawler.ts`

```ts
import { z } from 'zod';
import { URLParamSchema } from './client';

export const CrawlInputSchema = URLParamSchema;  // string | string[], httpUrl, non-empty

export const CrawlOptionsSchema = z.object({
    includeErrors: z.boolean().default(true),
});

export const CrawlDownloadOptionsSchema = z.object({
    pollInterval: z.number().positive().optional(),
    pollTimeout: z.number().positive().optional(),
});

export type CrawlOptions = z.input<typeof CrawlOptionsSchema>;
export type CrawlDownloadOptions = z.input<typeof CrawlDownloadOptionsSchema>;
```

Note: `download()` does **not** take `includeErrors` — by then the trigger is done and the toggle no longer applies. This matches Python's signature (`download(snapshot_id, poll_interval, poll_timeout)`).

### `src/api/crawler/service.ts`

```ts
import { API_ENDPOINT } from '../../utils/constants';
import { Transport, assertResponse } from '../../core/transport';
import { parseResponse } from '../../utils/misc';
import { getLogger } from '../../utils/logger';
import { assertSchema } from '../../schemas/utils';
import {
    CrawlInputSchema,
    CrawlOptionsSchema,
    CrawlDownloadOptionsSchema,
    type CrawlOptions,
    type CrawlDownloadOptions,
} from '../../schemas/crawler';
import { SnapshotMetaResponseSchema } from '../../schemas/responses';
import { ScrapeJob } from '../scrape/job';
import { CrawlResult, type CrawlRecord } from './result';
import type { SnapshotOperations } from '../../types/datasets';

const DATASET_ID = 'gd_m6gjtfmeh43we6cqc';
const PLATFORM = 'crawler';

export class CrawlerService {
    private transport: Transport;
    private snapshotOps: SnapshotOperations;
    private logger = getLogger('crawler');

    constructor(opts: { transport: Transport; snapshotOps: SnapshotOperations }) {
        this.transport = opts.transport;
        this.snapshotOps = opts.snapshotOps;
    }

    /** Sync: POST /datasets/v3/scrape, return inline result. Never throws on HTTP errors. */
    async crawl(
        urls: string | string[],
        opts: CrawlOptions = {},
    ): Promise<CrawlResult> {
        const safeUrls = assertSchema(CrawlInputSchema, urls, 'crawler.crawl.urls');
        const safeOpts = assertSchema(CrawlOptionsSchema, opts, 'crawler.crawl.opts');
        const urlList = Array.isArray(safeUrls) ? safeUrls : [safeUrls];

        this.logger.info(`crawl: ${urlList.length} url(s)`);
        const triggerSentAt = new Date();

        try {
            const response = await this.transport.request(API_ENDPOINT.SCRAPE_SYNC, {
                method: 'POST',
                query: {
                    dataset_id: DATASET_ID,
                    notify: 'false',
                    include_errors: safeOpts.includeErrors ? 'true' : 'false',
                },
                body: JSON.stringify({ input: urlList.map((url) => ({ url })) }),
            });

            const text = await assertResponse(response);
            const records = parseRecords(text);
            return new CrawlResult({
                success: true,
                data: records,
                pageCount: records.length,
                triggerSentAt,
                dataFetchedAt: new Date(),
            });
        } catch (e: unknown) {
            return new CrawlResult({
                success: false,
                error: (e as Error).message,
                triggerSentAt,
                dataFetchedAt: new Date(),
            });
        }
    }

    /** Async: POST /datasets/v3/trigger, return job handle. Raises on API failure. */
    async trigger(
        urls: string | string[],
        opts: CrawlOptions = {},
    ): Promise<ScrapeJob> {
        const safeUrls = assertSchema(CrawlInputSchema, urls, 'crawler.trigger.urls');
        const safeOpts = assertSchema(CrawlOptionsSchema, opts, 'crawler.trigger.opts');
        const urlList = Array.isArray(safeUrls) ? safeUrls : [safeUrls];

        this.logger.info(`trigger: ${urlList.length} url(s)`);

        const response = await this.transport.request(API_ENDPOINT.SCRAPE_ASYNC, {
            method: 'POST',
            query: {
                dataset_id: DATASET_ID,
                notify: 'false',
                include_errors: safeOpts.includeErrors ? 'true' : 'false',
            },
            body: JSON.stringify({ input: urlList.map((url) => ({ url })) }),
        });

        const text = await assertResponse(response);
        const meta = parseResponse(text, SnapshotMetaResponseSchema, 'crawler.trigger');
        return new ScrapeJob(meta.snapshot_id, this.snapshotOps, {
            platform: PLATFORM,
        });
    }

    /** Convenience: status by snapshot_id (single-shot probe). */
    async status(snapshotId: string): Promise<string> {
        const meta = await this.snapshotOps.getStatus(snapshotId);
        return meta.status;
    }

    /** Convenience: poll + fetch by snapshot_id, wrap in CrawlResult. Never throws on HTTP errors. */
    async download(
        snapshotId: string,
        opts: CrawlDownloadOptions = {},
    ): Promise<CrawlResult> {
        const safeOpts = assertSchema(
            CrawlDownloadOptionsSchema,
            opts,
            'crawler.download.opts',
        );
        const job = new ScrapeJob(snapshotId, this.snapshotOps, { platform: PLATFORM });
        const scrapeResult = await job.toResult({
            pollInterval: safeOpts.pollInterval,
            pollTimeout: safeOpts.pollTimeout,
        });

        // Adapt ScrapeResult → CrawlResult. Five-line adapter keeps download()'s
        // return type aligned with crawl() without forking ScrapeJob.toResult().
        return new CrawlResult({
            success: scrapeResult.success,
            data: (scrapeResult.data as CrawlRecord[] | null) ?? [],
            pageCount: scrapeResult.rowCount,
            snapshotId: scrapeResult.snapshotId,
            triggerSentAt: scrapeResult.triggerSentAt,
            dataFetchedAt: scrapeResult.dataFetchedAt,
            error: scrapeResult.error,
        });
    }
}

function parseRecords(text: string): CrawlRecord[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed.filter(isRecord);
        if (isRecord(parsed)) return [parsed];
        return [];
    } catch {
        // NDJSON fallback — snapshot endpoint can come back line-delimited.
        return trimmed
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .flatMap((line) => {
                try {
                    const x = JSON.parse(line) as unknown;
                    if (Array.isArray(x)) return x.filter(isRecord);
                    if (isRecord(x)) return [x];
                    return [];
                } catch {
                    return [];
                }
            });
    }
}

function isRecord(x: unknown): x is CrawlRecord {
    return typeof x === 'object' && x !== null && !Array.isArray(x);
}
```

### `src/api/crawler/index.ts`

```ts
export { CrawlerService } from './service';
export { CrawlResult } from './result';
export type { CrawlRecord, CrawlResultFields } from './result';

// CrawlJob is an alias for ScrapeJob — the snapshot-job wrapper is generic.
// Re-exported under the crawler name so porters from Python keep the same vocabulary.
export { ScrapeJob as CrawlJob } from '../scrape/job';
```

### Wiring on `bdclient` (`src/client.ts`)

Add alongside the existing lazy getters in the constructor. Declaration on the class:

```ts
declare crawler: CrawlerService;
```

In the constructor, after the other `defineLazy` calls:

```ts
defineLazy(this, 'crawler', () => {
    // Reuse one SnapshotAPI per client. Could share with ScrapeRouter's instance,
    // but ScrapeRouter doesn't currently expose its snapshot, and a fresh instance
    // is cheap (it's just methods over the shared Transport).
    const snapshotOps = new SnapshotAPI({ transport: this.transport });
    return new CrawlerService({ transport: this.transport, snapshotOps });
});
```

### Public exports (`src/index.ts`)

Mirror Discover's block (lines 25-29 currently):

```ts
// ── Crawler ──────────────────────────────────────────────────────
export { CrawlerService } from './api/crawler/service';
export { CrawlResult } from './api/crawler/result';
export { ScrapeJob as CrawlJob } from './api/scrape/job';
export type { CrawlRecord, CrawlResultFields } from './api/crawler/result';
export type { CrawlOptions, CrawlDownloadOptions } from './schemas/crawler';
```

## Open decisions

1. **Share `SnapshotAPI` with `ScrapeRouter`?** `ScrapeRouter` already constructs one and shares it across all platform APIs (`src/api/scrape/router.ts`). The crawler will construct its own. Sharing would save one instance but `ScrapeRouter` doesn't expose `snapshot` publicly today, and an extra `SnapshotAPI` is essentially free (it's stateless methods over the shared `Transport`). **Recommendation: don't share yet. Revisit only if there's a concrete reason.**

2. **Polling defaults.** Python defaults `poll_interval=5s`, `poll_timeout=600s`. JS `ScrapeJob.toResult` defaults `pollInterval=10s`, `pollTimeout=600s`. There's a 5s-vs-10s gap. **Recommendation: keep the JS defaults to stay consistent with the rest of the SDK; users can pass `{pollInterval: 5000}` when they want the Python default.** Note in the user-facing docs.

3. **Output format.** Python's crawler hardcodes `format=json` on the snapshot download. The Datasets API supports `json`, `csv`, `ndjson`/`jsonl`. **Recommendation: JSON-only in v1 to match Python and skip bikeshedding parse paths. `parseRecords` already tolerates NDJSON if the server happens to return it.**

4. **`includeErrors` default.** Python defaults to `true`. **Recommendation: match Python — default `true`.**

5. **Single-URL convenience return.** Python returns `data` as `list[dict]` even for one URL. The wire endpoint can return either a single object or a list depending on the input shape. **Recommendation: always normalize to an array (`parseRecords` does this).**

6. **Cancellation.** `ScrapeJob.cancel()` already hits `/datasets/v3/snapshot/{id}/cancel`. Works for crawler jobs without any new code. **Recommendation: document it on `CrawlerService` but don't re-implement it.**

7. **Subpath export `@brightdata/sdk/crawler`?** Discover doesn't have one; matches that pattern. **Recommendation: skip in v1. Add later only if there's user demand for tree-shaking the crawler in isolation.**

## Test plan

New file `tests/crawler.test.ts`, mirroring the layout of `tests/discover.test.ts`:

- **Schema-level**
  - `CrawlInputSchema` accepts a URL string, a non-empty `string[]`, rejects empty list, rejects non-URL.
  - `CrawlOptionsSchema` defaults `includeErrors` to true; rejects non-boolean.
  - `CrawlDownloadOptionsSchema` accepts positive numbers; rejects negative/zero.
- **`CrawlResult` class**
  - `toJSON()` includes `pageCount` and `snapshotId` on top of `BaseResult` fields.
  - `toString()` includes truncated `snapshot_id` and `pages=`.
  - `elapsedMs()` works when both timestamps are set.
- **`crawl()` (sync inline, mocked transport)**
  - Single URL → `CrawlResult({ success: true, pageCount: 1 })` with the record in `data[0]`.
  - Multi URL → matching `pageCount`.
  - HTTP 500 → `CrawlResult({ success: false, error: ... })` (no throw).
  - Network error → same shape, no throw.
  - Validation error on URL → throws `ValidationError`.
  - NDJSON response body → still parsed correctly.
- **`trigger()` (mocked transport)**
  - Returns `ScrapeJob` with the right `snapshotId`, `platform === 'crawler'`.
  - Missing `snapshot_id` in response → `APIError` (via `parseResponse` failing schema).
  - HTTP 4xx/5xx → `APIError`.
- **`status()` (mocked transport)**
  - Returns the upstream status string.
- **`download()` (mocked transport)**
  - Polls progress, then fetches snapshot, returns `CrawlResult({ success: true })` once ready.
  - Polling timeout → `CrawlResult({ success: false })` (via `ScrapeJob.toResult` → adapter).
  - `DataNotReadyError` race condition is handled by `ScrapeJob.toResult` already — sanity-check the wiring.
- **Integration (gated, in `tests/integration/` matching the existing pattern)**
  - Live `crawl('https://example.com')` returns at least one record with `url` and `markdown`.
  - Live `trigger()` + `download()` round-trip.

## Diff summary

| Action | File | Approx LOC |
|---|---|---|
| Add | `src/api/crawler/service.ts` | ~140 |
| Add | `src/api/crawler/result.ts` | ~45 |
| Add | `src/api/crawler/index.ts` | ~6 |
| Add | `src/schemas/crawler.ts` | ~18 |
| Add | `tests/crawler.test.ts` | ~250 |
| Edit | `src/client.ts` | +12 |
| Edit | `src/index.ts` | +6 |

Total: ~300 LOC of source + ~250 LOC of tests. No edits to `Transport`, `SnapshotAPI`, `ScrapeJob`, `BaseResult`, `ScrapeResult`, or any platform scraper.

## What this proposal does and doesn't do

**Does:**
- Add `CrawlerService` at `client.crawler`, matching the Python SDK's namespace exactly.
- Add a dedicated `CrawlResult` class extending `BaseResult`, matching the JS SDK's one-Result-per-service convention (`ScrapeResult`, `SearchResult`, `DiscoverResult`) and Python's `CrawlResult`.
- Reuse `ScrapeJob` as the snapshot-job wrapper, re-exported as `CrawlJob` for porters. `ScrapeJob` is already generic over `SnapshotOperations`; no fork needed.
- Reuse the entire HTTP/polling/snapshot stack (`Transport`, `SnapshotAPI`, `pollUntilReady`, `Deadline`).

**Doesn't:**
- Doesn't mint a new `CrawlJob` class. The existing `ScrapeJob` already does the job; the type alias gives porters the name they expect.
- Doesn't fork `ScrapeJob.toResult()` for the crawler. `download()` calls it and adapts the result into `CrawlResult` in five lines.
- Doesn't ship a `/crawler` subpath build. Discover doesn't have one; we can add it later if needed.
- Doesn't touch `BaseAPI`. The platform-scraper template doesn't fit the crawler cleanly (no `DATASET_ID` map, no discovery semantics, no per-platform filter schemas), and forcing it would add more friction than the ~30 lines of POST logic we'd save.
