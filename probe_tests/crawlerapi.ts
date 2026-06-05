// Run: npx tsx probe_tests/crawlerapi.ts
import 'dotenv/config';
import { bdclient } from '../src/index';

const client = new bdclient({ autoCreateZones: false });

function preview(val: unknown, maxLen = 200): string {
    const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

async function test1_basicCrawl() {
    console.log('\n=== Test 1: Basic Crawl (sync, single URL) ===');
    const url = 'https://example.com';
    console.log(`URL: ${url}\n`);

    const t = Date.now();
    const result = await client.crawler.crawl(url);
    console.log(`⏱  ${Date.now() - t}ms`);

    console.log(`Success: ${result.success}`);
    console.log(`Page Count: ${result.pageCount}`);
    console.log(`Snapshot ID: ${result.snapshotId ?? 'N/A (sync path)'}`);
    console.log(`Error: ${result.error ?? 'none'}`);

    if (result.success && result.data?.[0]) {
        const record = result.data[0];
        console.log('\n--- record[0] fields ---');
        console.log('Available keys:', Object.keys(record));
        console.log(`input:     ${preview(record.input, 80)}`);
        console.log(`url:       ${record.url}`);
        console.log(`markdown:  ${preview(record.markdown, 150)}`);
        if (record.html2text) {
            console.log(`html2text: ${preview(record.html2text, 100)}`);
        }
        if (record.page_html) {
            console.log(`page_html: ${preview(record.page_html, 80)}`);
        }
    }

    return result;
}

async function test2_batchCrawl() {
    console.log('\n=== Test 2: Batch Crawl (sync, multi URL) ===');
    const urls = ['https://example.com', 'https://example.com/about'];
    console.log(`URLs: ${urls.join(', ')}\n`);

    const t = Date.now();
    const result = await client.crawler.crawl(urls);
    console.log(`⏱  ${Date.now() - t}ms`);

    console.log(`Success: ${result.success}`);
    console.log(`Page Count: ${result.pageCount}`);
    console.log(`Expected:   ${urls.length}`);

    if (result.success && result.data) {
        console.log('\n--- per-record summary ---');
        for (const [i, rec] of result.data.entries()) {
            const mdLen = String(rec.markdown ?? '').length;
            const stub = !rec.url && mdLen === 0 ? '  ← empty (likely error stub)' : '';
            console.log(
                `  [${i}] input=${preview(rec.input, 60)} | url=${rec.url ?? 'N/A'} | markdown: ${mdLen} chars${stub}`,
            );
        }
    } else {
        console.log(`\nError: ${result.error}`);
    }

    return result;
}

async function test3_includeErrorsFalse() {
    console.log('\n=== Test 3: includeErrors=false ===');
    const url = 'https://example.com';
    console.log(`URL: ${url}`);
    console.log('includeErrors: false\n');

    const t = Date.now();
    const result = await client.crawler.crawl(url, { includeErrors: false });
    console.log(`⏱  ${Date.now() - t}ms`);

    console.log(`Success: ${result.success}`);
    console.log(`Page Count: ${result.pageCount}`);
    if (!result.success) {
        console.log(`Error: ${result.error}`);
    }

    return result;
}

async function test4_manualTriggerStatusDownload() {
    console.log('\n=== Test 4: Manual Trigger / Status / Download ===');
    const url = 'https://example.com';
    console.log(`URL: ${url}\n`);

    // Step 1: Trigger
    const job = await client.crawler.trigger(url);
    console.log(`Step 1 - Triggered: ${job}`);
    console.log(`   Snapshot ID: ${job.snapshotId}`);
    console.log(`   Platform: ${job.platform}`);
    console.log(`   Triggered at: ${job.triggeredAt.toISOString()}`);

    // Step 2: Initial status
    const initialStatus = await client.crawler.status(job.snapshotId);
    console.log(`\nStep 2 - Initial status: ${initialStatus}`);

    // Step 3: Download (poll + fetch)
    console.log('\nStep 3 - Polling for completion (5s interval, 8min timeout)...');
    const tDownload = Date.now();
    const result = await client.crawler.download(job.snapshotId, {
        pollInterval: 5_000,
        pollTimeout: 480_000,
    });
    console.log(`⏱  download took ${((Date.now() - tDownload) / 1000).toFixed(1)}s`);

    console.log(`\nStep 4 - Result:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Page Count: ${result.pageCount}`);
    console.log(`   Snapshot ID: ${result.snapshotId}`);
    if (result.success && result.data?.[0]) {
        console.log(`   First record url: ${result.data[0].url}`);
        console.log(`   First record keys: ${Object.keys(result.data[0]).join(', ')}`);
    } else if (!result.success) {
        console.log(`   Error: ${result.error}`);
    }

    return result;
}

async function test5_timingMetadata(result: {
    success: boolean;
    pageCount: number | null;
    snapshotId: string | null;
    triggerSentAt: Date | null;
    dataFetchedAt: Date | null;
    elapsedMs: () => number | null;
    toJSON: () => Record<string, unknown>;
    toString: () => string;
}) {
    console.log('\n=== Test 5: Timing & Serialization Metadata ===');
    console.log(`success: ${result.success}`);
    console.log(`pageCount: ${result.pageCount}`);
    console.log(`snapshotId: ${result.snapshotId}`);
    console.log(`triggerSentAt: ${result.triggerSentAt?.toISOString()}`);
    console.log(`dataFetchedAt: ${result.dataFetchedAt?.toISOString()}`);

    const elapsed = result.elapsedMs();
    if (elapsed) {
        console.log(`elapsedMs: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);
    }

    console.log(`\n--- toString() ---`);
    console.log(result.toString());

    console.log(`\n--- toJSON() shape ---`);
    const json = result.toJSON();
    console.log('Keys:', Object.keys(json));
    console.log('pageCount:', json.pageCount);
    console.log('snapshotId:', json.snapshotId);
}

async function test6_validationError() {
    console.log('\n=== Test 6: Validation Error (bad URL) ===');
    try {
        await client.crawler.crawl('not-a-url');
        console.log('ERROR: should have thrown');
    } catch (err) {
        console.log(`Caught: ${(err as Error).constructor.name}`);
        console.log(`Message: ${(err as Error).message}`);
    }
}

// --- Run all tests ---
try {
    const r1 = await test1_basicCrawl();
    await test2_batchCrawl();
    await test3_includeErrorsFalse();
    await test4_manualTriggerStatusDownload();
    await test5_timingMetadata(r1);
    await test6_validationError();

    console.log('\n\nALL TESTS COMPLETE');
} catch (err) {
    console.error(`\nFAIL: ${(err as Error).constructor.name}: ${(err as Error).message}`);
    process.exitCode = 1;
} finally {
    await client.close();
}
