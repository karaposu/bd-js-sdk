# intro2codebase — Bright Data JavaScript SDK

This is a TypeScript SDK that wraps several Bright Data products: the Web Unlocker (`/request`), the SERP API (same endpoint, search-URL flavored), the Datasets v3 scraper engine (LinkedIn, Amazon, Instagram, etc.), the pre-collected datasets service, the Discover API (AI search), Scraper Studio (DCA / custom collectors), and Browser API (CDP WebSocket URLs). The whole thing ships as a single npm package (`@brightdata/sdk`) with a Rollup multi-entry build into ESM + CJS plus a typed top-level entry and three tree-shakeable subpath entries (`/scrapers`, `/search`, `/datasets`).

Take a few minutes with `src/index.ts`, `src/client.ts`, `src/core/transport.ts`, and `src/api/scrape/base.ts` — that's the spine.

## The 30-second mental model

```
                ┌────────────────────────────┐
                │   bdclient   (facade)      │  src/client.ts
                └─────────────┬──────────────┘
                              │ lazy getters wire each service
        ┌──────────────┬──────┼────────┬──────────────┬──────────────┐
        ▼              ▼      ▼        ▼              ▼              ▼
   ScrapeRouter   SearchRouter  DatasetsClient  ScraperStudio  BrowserService
   (platforms)    (engines)     (pre-collected) Service        (no HTTP — URL builder)
        │              │              │              │
        └───────┬──────┴──────┬───────┴──────┬───────┘
                ▼             ▼              ▼
            RequestAPI     BaseAPI       BaseDataset
            (Unlocker)     (Datasets v3) (Datasets read)
                └─────────────┬─────────────┘
                              ▼
                         ┌─────────┐
                         │Transport│  src/core/transport.ts
                         └────┬────┘
                              │
                          undici Agent
                       ┌──────┴───────┐
                       │ dns + retry  │
                       │ interceptors │
                       └──────────────┘
                  (RateLimiter, AuthHeaders, AbortSignal timeouts)
```

There are essentially three layers: a facade (`bdclient`), a set of feature-specific service classes living under `src/api/`, and a single shared HTTP transport under `src/core/`. Everything that goes over the wire goes through the same `Transport` instance.

## Main abstractions

### `bdclient` — the facade (src/client.ts)

A user constructs one of these and gets everything via property access: `client.scrape.linkedin.profiles(urls)`, `client.search.google(q)`, `client.datasets.amazonProducts.sample()`, `client.scraperStudio.run(...)`, `client.browser.getConnectUrl()`, plus a few convenience methods that sit directly on the client (`client.scrapeUrl`, `client.discover`, `client.saveResults`, `client.listZones`, `client.close`).

Two implementation notes worth knowing up front:

- The sub-services are attached via a `defineLazy` helper that installs a getter that replaces itself with the constructed value on first access. So you only pay for the parts you use. There are also two manual lazy getters (`scrapeAPI`, `discoverService`) for the convenience methods.
- The Browser API getter throws if you never set `browserUsername`/`browserPassword` (constructor args or env vars). It's the only service with credentials separate from the main API token, because the Browser API uses a different auth model (CDP proxy username/password rather than an API bearer token).

The class is `await using`-compatible (`Symbol.asyncDispose`). If you forget to close it, the transport prints a `beforeExit` warning telling you to call `client.close()`.

### `Transport` — the only thing that talks HTTP (src/core/transport.ts)

One shared `undici` `Agent` composed with `dns()` and `retry()` interceptors. The retry interceptor handles 429, 500–504, and a curated list of network error codes (`ECONNRESET`, `UND_ERR_CONNECT_TIMEOUT`, etc.) — see `src/utils/constants.ts` for the full list. There's a `RateLimiter` (token bucket, `src/core/rate-limiter.ts`) that's only attached if you pass `rateLimit`. Auth headers (`Authorization: Bearer …`, `Content-Type`, `User-Agent`) are merged into every request.

Two methods: `request()` (buffered) and `stream()` (used for snapshot downloads where the body is written directly to disk via `createWriteStream`).

`classifyError()` is where raw undici failures become typed `BRDError`s — timeout names become `NetworkTimeoutError`, `RequestRetryError` becomes whatever the final status code says it should be (`401/403` → `AuthenticationError`, `400` → `ValidationError`, anything else → `APIError`), everything else becomes `NetworkError`.

`assertResponse(response, parse?)` is the standard "did this succeed" helper that every call site uses. It also re-routes ≥400 responses into `throwInvalidStatus`, so errors come from one place.

### Two abstract base classes — `RequestAPI` and `BaseAPI`

These split along the product line.

**`RequestAPI`** (`src/api/unlocker/request.ts`) is for the Web Unlocker product — the single-shot `/request` endpoint. Subclasses fill in:

- `getURL(content, opt)` — for `ScrapeAPI` it's a pass-through; for `SearchAPI` it builds a SERP URL (`https://www.google.com/search?q=…&brd_json=1`, Bing, or Yandex variant).
- `getMethod(opt)` — `ScrapeAPI` passes through, `SearchAPI` forces `GET`.

`handle()` validates the zone, optionally calls `zonesAPI.ensureZone()` if `autoCreateZones` is on, and then branches on `Array.isArray(val)` into `handleSingle` (one POST) or `handleBatch` (a `@supercharge/promise-pool` with bounded concurrency that *preserves order* and *swallows per-URL errors into `BRDError` slots in the result array* — failures don't take down the batch).

**`BaseAPI`** (`src/api/scrape/base.ts`) is for the Datasets v3 *scraper* engine — every platform scraper extends this. Subclasses just set `this.name`, hardcode a few `DATASET_ID` constants, and expose methods like `collectProducts`, `discoverByCategory`, `products`. The base provides:

- `run(input, datasetId, opt)` — POSTs to `/datasets/v3/scrape` (sync) or `/datasets/v3/trigger` (async). If the response is async or 202, it builds a `ScrapeJob`. Otherwise returns the data inline.
- `orchestrate(input, datasetId, opts)` — forces async, then `job.toResult()`. This is the "one-call trigger+poll+fetch" path, exposed as `.products()`, `.profiles()`, `.posts()` etc. on each platform.

The platform API files (`amazon.ts`, `linkedin.ts`, `facebook.ts`, …) follow a uniform pattern:
1. A `DATASET_ID` const object mapping logical names to opaque `gd_…` IDs.
2. A local `assertInput()` helper that runs zod schemas over the args and prefixes errors with the method name.
3. Methods either delegate to `this.run()` (returns raw data or a `ScrapeJob`) or `this.orchestrate()` (returns a `ScrapeResult`).

The "discover" methods are just `run()` with `{async: true, type: 'discover_new', discoverBy: '...'}` baked in — same code path, different query parameters.

### The Job / Result pair

This pattern shows up three times — once each for the scrape engine, Discover, and Scraper Studio.

**Jobs** (`ScrapeJob`, `DiscoverJob`, `ScraperStudioJob`) wrap an opaque server-side identifier (`snapshot_id`, `task_id`, `response_id`) and expose `status()`, `wait()`, `fetch()`, and a `toResult()` (or `waitAndFetch()`) that combines the three. They cache the last seen status so you can re-read without an HTTP round-trip.

**Results** (`BaseResult` in `src/models/result.ts`, plus `ScrapeResult`, `SearchResult`, `DiscoverResult`) are dumb data containers: `success`, `data`, `error`, `cost`, `triggerSentAt`, `dataFetchedAt`. They have `toJSON()`, `toString()`, and an `elapsedMs()`. **`toResult()` is intentionally never-throws** — failures become `success: false` with the message in `error`. Callers can branch on `.success` instead of wrapping everything in try/catch.

There's a meaningful subtlety in `ScrapeJob.toResult()` worth pointing out: it uses a `Deadline` (`src/utils/deadline.ts`) so that the **total** time budget is enforced across race-condition retries. The race condition is real — the status endpoint can return `ready` while the snapshot download endpoint still returns 202 (`DataNotReadyError`). Without a deadline, each retry would get a fresh full timeout. The comment in the code calls this out explicitly: "the bug that Deadline was created to prevent."

### Polling

There's a shared `pollUntilReady` (`src/utils/polling.ts`) — a simple loop that calls `getStatus(id)` every N ms until status is `ready`, throwing on `failed` / `error` or timeout. It's used by `ScrapeJob.wait()`, `SnapshotAPI.#awaitReady`, and `BaseDataset.download()`.

But `DiscoverJob.wait()` and `ScraperStudioJob.waitAndFetch()` each implement their own loops, because they have different signals: Discover polls a status endpoint and looks for `status === 'done'`; Scraper Studio polls by *fetching* and treats 202 (`DataNotReadyError`) as "not ready yet." So `pollUntilReady` is the building block, not the only path.

### Schemas (Zod) and types

Schemas live under `src/schemas/`, types under `src/types/`. The relationship is one-way: **types are inferred from schemas** (`z.input<...>`, `z.infer<...>`), so the schema is the single source of truth for both runtime validation and the TS surface.

`assertSchema(schema, input, label)` (in `src/schemas/utils.ts`) is the standard validation entry point. It calls `safeParse`, and on failure throws a `ValidationError` with `z.prettifyError(...)` and the label. Every public method validates its arguments through this helper — `scrapeUrl`, every platform scrape method, Discover, Scraper Studio.

`parseResponse(text, schema, label)` is the analog for *response* validation. The schemas for responses (`src/schemas/responses.ts`, plus discover/scraperstudio specific ones) use `.passthrough()` so unknown fields are kept but the *critical* fields (`snapshot_id`, `status`, etc.) are validated. The Scraper Studio response schema does a particularly thorough job: the upstream API returns mixed-case keys (`Id` and `id`, `Status` and `status`, `Success_rate`, `Job_time`), and the schema's `.transform()` normalizes them to a single camelCase shape.

Per-platform filter schemas live under `src/schemas/filters/` (Amazon, LinkedIn, Facebook, Instagram, ChatGPT — these are the platforms with structured filter inputs beyond plain URL lists).

### `DatasetsClient` (the pre-collected datasets service)

This is structurally simple but visually overwhelming: `src/api/datasets/client.ts` is ~99K of mechanical boilerplate. Each of ~126 pre-built datasets (Amazon products, Zillow, Wikipedia, GitHub repos, Walmart sellers, …) has:

- A trivial subclass of `BaseDataset` in `src/api/datasets/platforms/*.ts` that just sets `datasetId = 'gd_…'` and `name = '…'`.
- A getter property on `DatasetsClient` that lazily constructs the subclass and caches it in a `Map`.

`BaseDataset` itself is small: `getMetadata()`, `query(filter)`, `sample()`, `getStatus()`, `download()`. These hit a different set of endpoints (`/datasets/list`, `/datasets/{id}/metadata`, `/datasets/filter`, `/datasets/snapshots/{id}`, `/datasets/snapshots/{id}/download`) — note that **these are separate from `/datasets/v3/*` used by the scrape engine**. Same word "datasets," totally different products. The constants file (`src/utils/constants.ts`) has a comment that calls this out, and it's worth re-reading when you're confused about which dataset code path you're in.

### `ZonesAPI` (src/api/zones.ts)

Manages Bright Data "zones" (logical proxy pools). The relevant behavior:

- `listZones()` — `GET /zone/get_active_zones`, normalizes the response.
- `ensureZone(name, {type})` — caches the zone list, and if the zone is missing and `autoCreateZones` is true, POSTs a default config to `/zone` to create it. If it exists but with a wrong type, throws `ZoneError`.

The default zones are `sdk_unlocker` and `sdk_serp` (from `constants.ts`); a user can override either with env vars or constructor options.

### Errors (`src/utils/errors.ts`)

One root `BRDError extends Error`, then subclasses for `ValidationError`, `AuthenticationError`, `ZoneError`, `NetworkError`, `NetworkTimeoutError` (extends NetworkError), `TimeoutError`, `FSError`, `APIError`, `DataNotReadyError`. All override `toJSON()`. The transport's `classifyError` and `throwInvalidStatus` are the only two places that construct the network/API ones — call sites just throw `ValidationError` directly when they want to.

### Logger (`src/utils/logger.ts`)

Module-scoped state set once via `setup()` from the client constructor: `currentLogLevel`, `isStructuredLogging`, `isVerbose`. `getLogger(name)` returns a labeled object with `debug`/`info`/`warning`/`error`/`critical`. Default output is JSON-per-line; you can switch to a formatted-text mode. Quiet by default — DEBUG/INFO only print when `verbose: true`.

## Data flow paths

### `client.scrapeUrl(url)` — single Web Unlocker call

1. `scrapeUrl(url, opts)` validates both args via zod (`URLParamSchema`, `ScrapeOptionsSchema`).
2. Lazily instantiates `ScrapeAPI` (extends `RequestAPI`), pinned to the Web Unlocker zone.
3. `RequestAPI.handle()` validates the zone, optionally ensures it via `ZonesAPI`.
4. `handleSingle()` builds a body `{url, zone, method, format, country, data_format}` and POSTs to `/request` via `Transport.request()`.
5. Transport applies rate limit → auth headers → timeout → undici Agent (with retry+dns) → response.
6. `assertResponse` reads the body, throws if status ≥ 400.
7. If `format === 'json'`, JSON-parses; otherwise returns the raw text.

### `client.scrapeUrl([url1, url2, …])` — batch

Same as above except `handleBatch()` runs each URL through `PromisePool.for(...).withConcurrency(...).useCorrespondingResults().process(...)`. Per-URL errors are caught and slotted into the result array as `BRDError`, preserving input order. Concurrency defaults to 10.

### `client.search.google(query)` — SERP

`SearchRouter` constructs a `SearchAPI` (extends `RequestAPI`). Same `/request` endpoint, but `getURL` builds a SERP URL with `brd_json=1` (Google), `mkt=lang_COUNTRY` (Bing), or `numdoc=…` (Yandex). Zone type is `serp` instead of `unblocker`.

### `client.scrape.linkedin.profiles(urls)` — orchestrated platform scrape

1. `LinkedinAPI.profiles(urls)` validates inputs, then calls `BaseAPI.orchestrate(input, DATASET_ID.PROFILE, opts)`.
2. `orchestrate()` calls `run(..., {async: true, format})`.
3. `run()` POSTs to `/datasets/v3/trigger?dataset_id=…` with the URL list as the body. The response is `{snapshot_id: …}` — validated through `SnapshotMetaResponseSchema`.
4. Returns a `ScrapeJob` wrapping the snapshot_id and a `SnapshotOperations` (which is `SnapshotAPI`, also a `BaseAPI` subclass — `ScrapeRouter` constructs it once in its constructor and shares it across all platform APIs).
5. `job.toResult()`:
   - Loops with `Deadline(600_000ms)` budget.
   - `wait()` → `pollUntilReady` → `GET /datasets/v3/progress/{id}` every 10s until `status === 'ready'`.
   - `fetch()` → `GET /datasets/v3/snapshot/{id}?format=…`. If 202, throws `DataNotReadyError` and the outer loop sleeps `pollInterval` and retries.
   - On success: wraps the data in `ScrapeResult` with `success: true`, `rowCount`, timing.
   - On any failure: wraps in `ScrapeResult` with `success: false` and the error message. **Never throws.**

### `client.discover(query)` — AI search

`DiscoverService.search` → `_trigger` POSTs to `/discover` → returns `{task_id}` → `DiscoverJob` → `toResult()` → loop:
- Polls `GET /discover?task_id=…`.
- Done when `status === 'done'`. Results come back *in the poll response itself* (not via a separate fetch endpoint).
- Wraps in `DiscoverResult`.

### `client.scraperStudio.run(collector, {input})` — custom DCA collector

`ScraperStudioService.run` iterates inputs (each runs serially, not concurrently). For each:
- `_trigger` POSTs to `/dca/trigger_immediate?collector=…` with the input body → `{response_id}`.
- `ScraperStudioJob.waitAndFetch` polls by **fetching directly** (`GET /dca/get_result?response_id=…`); a 202 throws `DataNotReadyError` and the loop retries. Also has a small per-job network-retry budget (`MAX_NETWORK_RETRIES = 3`) for transient `NetworkError`.

Each input gets a `RunResult` with `data`, `error`, `responseId`, `elapsedMs`. Failures don't stop the batch — same philosophy as `handleBatch` in `RequestAPI`.

### `client.datasets.amazonProducts.query({brand: 'Nike'})` — pre-collected query

`AmazonProductsDataset` (lazy on `DatasetsClient`) extends `BaseDataset`. `query()` POSTs `{dataset_id, filter, records_limit?}` to `/datasets/filter` → returns `snapshot_id`. Then `download(snapshot_id)` polls `/datasets/snapshots/{id}` via `pollUntilReady` until ready, then `GET /datasets/snapshots/{id}/download` → JSON array.

### `client.browser.getConnectUrl({country: 'gb'})` — no HTTP at all

The `BrowserService` doesn't talk to Bright Data over HTTP. It just builds a `wss://user:pass@brd.superproxy.io:9222` URL for an external CDP client (Playwright/Puppeteer) to consume. The country option is encoded into the username (`{user}-country-gb`).

## Top-level design patterns

- **Facade + lazy services.** One `bdclient` exposes everything; sub-services are constructed on first access via `defineLazy` getters that overwrite themselves with the constructed value. There's no shared "container" / DI framework — just JS getters and closures.
- **Template method via abstract base classes.** `RequestAPI` (Unlocker) and `BaseAPI` (Datasets v3) define a request skeleton; subclasses fill `getURL`/`getMethod`/`DATASET_ID`. `BaseDataset` is the analogue for the pre-collected datasets service.
- **Job + Result pair for every async product.** Repeated three times (`ScrapeJob`/`ScrapeResult`, `DiscoverJob`/`DiscoverResult`, `ScraperStudioJob` + bare arrays). Results capture timing, success, error, and never throw from the orchestrated `toResult()` path.
- **Zod schemas as the single source of truth.** Runtime validation and TS types both flow from the same schema declarations. Public methods validate every argument via `assertSchema`; responses are validated via `parseResponse` for the critical fields, with `.passthrough()` to keep unknown fields.
- **Single shared HTTP transport with composed undici interceptors.** Retry, DNS, rate limit, auth, timeout, and error classification all live behind one `Transport` instance — every service uses the same one.
- **Bounded-concurrency batching with order preservation.** `@supercharge/promise-pool` with `useCorrespondingResults()` and per-item error capture, so a batch returns "as many results as inputs" with errors slotted in place.
- **TypeScript overload-driven return types.** `scrapeUrl(string)` vs `scrapeUrl(string[])`, `{format:'json'}` vs default raw — each handler ships with four overload signatures so callers get the right return type without casts.

## Honest notes on what's inconsistent or messy

- **The word "datasets" is overloaded.** `client.scrape.*` triggers a scrape against a `dataset_id` via `/datasets/v3/*`. `client.datasets.*` queries pre-collected snapshots via `/datasets/*`. They're different products with different endpoints, but you'll see the same `gd_…` IDs in both `src/api/scrape/linkedin.ts` and `src/api/datasets/platforms/linkedin.ts`. There's a deliberate comment in `constants.ts` that flags this; expect to be confused once.
- **Three slightly different polling implementations.** `pollUntilReady` (generic), `ScrapeJob.toResult` (Deadline-bounded with race-condition retry), `DiscoverJob.wait` (status-polling with its own Deadline), `ScraperStudioJob.waitAndFetch` (fetch-polling with its own network-retry counter). They overlap but diverge enough that none of them is fully reusable for the others.
- **`DatasetsClient` is ~99K of nearly identical boilerplate.** 126 getter properties with the same `if (!cache.has(name)) cache.set(name, new XClass(...)); return cache.get(name) as XClass` shape. This is a deliberate trade — explicit, named TS types per dataset vs. one generic `get<T>(name, ctor)` — but it's a lot of code to scroll past.
- **Per-call schema assertion has minor duplication.** Every platform method calls `assertInput` (a local helper that runs schemas) *and* `forEach(item => assertSchema(filterSchema, item, ...))` for the filter array. Two passes over the same data, but it gives the per-item error labels (`amazon.collectProducts: invalid filter[3]`).
- **`bdclient` constructor reads from `process.env` directly.** Not abstracted — these calls are in the constructor body. Fine for Node, but means there's no clean injection point for testing or for a hypothetical browser/edge runtime. The package targets Node ≥20 anyway (per `engines`).
- **`Transport` registers a `process.on('beforeExit')` listener per instance.** If a long-running app constructs many `bdclient`s (probably an anti-pattern, but supported), each one leaks one listener until `close()` is called. The warning behavior is intentional and useful; the listener accumulation is the price.
- **`SearchRouter` repeats itself.** Three near-identical method blocks for `google`/`bing`/`yandex`, each with four overload signatures, all delegating to the same `searchAPI.handle()` with a different `searchEngine` field. Could compress, but readability is decent as-is.
- **`BaseAPI` and `RequestAPI` look similar but aren't related.** Both have `handle`/`run`, both have a `name`/`logger`, both take `transport` from options. They feel like they want a shared base, but they target different endpoints and different response shapes, so the duplication is intentional.

## Where to start reading, in order

1. `src/index.ts` — what's exported.
2. `src/client.ts` — how the facade wires everything.
3. `src/core/transport.ts` + `src/utils/constants.ts` — how requests actually go out.
4. `src/api/unlocker/request.ts` + `src/api/unlocker/scrape.ts` + `src/api/unlocker/search.ts` — the simpler request flow.
5. `src/api/scrape/base.ts` + `src/api/scrape/job.ts` + `src/api/scrape/snapshot.ts` — the async scrape flow with `Job`/`Result`/`Deadline`.
6. `src/api/scrape/linkedin.ts` — pick one platform; they're all the same shape.
7. `src/schemas/datasets.ts` + `src/schemas/utils.ts` + `src/schemas/responses.ts` — the validation contract.
8. `src/api/datasets/base.ts` + one tiny platform file (`platforms/bbc.ts`) — to understand what `DatasetsClient` actually is once you scroll past the 99K of boilerplate.
9. `src/api/discover/` and `src/api/scraperstudio/` — variants of the Job/Result pattern.

After that, the tests under `tests/` mirror the same module layout and are short — they're the fastest way to confirm any assumption you've formed about a given module.
