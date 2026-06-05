// Run: npx tsx probe_tests/scraperstudio.ts
// Requires: BRIGHTDATA_API_TOKEN in .env and a valid collector ID
import 'dotenv/config';
import { bdclient } from '../src/index';

const client = new bdclient({ autoCreateZones: false });

// Replace with your collector ID from Scraper Studio dashboard
const COLLECTOR_ID = 'c_mly0sa6x10hshxi8jb';
const TEST_URL = 'https://www.sahibinden.com/ilan/emlak-konut-satilik-golden-gate-1287846580/detay';

function preview(val: unknown, maxLen = 500): string {
    const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '\n... (truncated)' : str;
}

async function test1_trigger() {
    console.log('\n=== Test 1: Trigger ===');
    console.log(`Collector: ${COLLECTOR_ID}`);
    console.log(`Input: ${TEST_URL}\n`);

    const job = await client.scraperStudio.trigger(COLLECTOR_ID, {
        url: TEST_URL,
    });

    console.log(`Job triggered: ${job}`);
    console.log(`  responseId: ${job.responseId}`);
    console.log(`  triggeredAt: ${job.triggeredAt.toISOString()}`);

    return job;
}

async function test2_fetch(job: { responseId: string; fetch: () => Promise<unknown[]> }) {
    console.log('\n=== Test 2: Fetch (single attempt) ===');

    try {
        const data = await job.fetch();
        console.log(`Got ${data.length} record(s)`);
        if (data[0]) {
            const record = data[0] as Record<string, unknown>;
            const keys = Object.keys(record).slice(0, 5);
            for (const key of keys) {
                console.log(`  ${key}: ${preview(record[key], 100)}`);
            }
        }
        return data;
    } catch (e) {
        console.log(`Not ready yet: ${(e as Error).message}`);
        console.log('(This is expected — data takes time to collect)');
        return null;
    }
}

async function test3_waitAndFetch() {
    console.log('\n=== Test 3: Trigger + waitAndFetch ===');
    console.log(`Collector: ${COLLECTOR_ID}`);
    console.log(`Input: ${TEST_URL}\n`);

    const job = await client.scraperStudio.trigger(COLLECTOR_ID, {
        url: TEST_URL,
    });
    console.log(`Triggered: ${job.responseId}`);
    console.log('Waiting for results...');

    const start = Date.now();
    const data = await job.waitAndFetch();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`Got ${data.length} record(s) in ${elapsed}s`);
    if (data[0]) {
        console.log(`\nFirst record:\n${preview(data[0])}`);
    }

    return data;
}

async function test4_run() {
    console.log('\n=== Test 4: Run (orchestrated) ===');
    console.log(`Collector: ${COLLECTOR_ID}`);
    console.log(`Input: single URL\n`);

    const results = await client.scraperStudio.run(COLLECTOR_ID, {
        input: { url: TEST_URL },
    });

    console.log(`Results: ${results.length} RunResult(s)`);
    for (const [i, r] of results.entries()) {
        console.log(`\n  [${i}] responseId: ${r.responseId}`);
        console.log(`      elapsed: ${r.elapsedMs}ms`);
        if (r.data) {
            console.log(`      records: ${r.data.length}`);
            if (r.data[0]) {
                const record = r.data[0] as Record<string, unknown>;
                const keys = Object.keys(record).slice(0, 3);
                for (const key of keys) {
                    console.log(`      ${key}: ${preview(record[key], 80)}`);
                }
            }
        } else {
            console.log(`      error: ${r.error}`);
        }
    }

    return results;
}

async function test5_status(jobId: string) {
    console.log('\n=== Test 5: Job Status ===');
    console.log(`Job ID: ${jobId}\n`);

    const info = await client.scraperStudio.status(jobId);

    console.log(`  id:           ${info.id}`);
    console.log(`  status:       ${info.status}`);
    console.log(`  collector:    ${info.collector}`);
    console.log(`  inputs:       ${info.inputs}`);
    console.log(`  lines:        ${info.lines}`);
    console.log(`  fails:        ${info.fails}`);
    console.log(`  successRate:  ${info.successRate}`);
    console.log(`  jobTime:      ${info.jobTime}ms`);

    return info;
}

// --- Run tests ---
try {
    // Test 1: Trigger only
    const job = await test1_trigger();

    // Test 2: Single fetch attempt (likely 202)
    await test2_fetch(job);

    // Test 3: Trigger + wait for results
    await test3_waitAndFetch();

    // Test 4: Run (orchestrated single input)
    await test4_run();

    // Test 5: Job status (requires a known job ID from dashboard)
    // Uncomment and replace with a real job ID to test:
    // await test5_status('j_mly4pzxd1mj4u0gjj8');

    console.log('\n\nALL TESTS PASSED');
} catch (err) {
    console.error(
        `\nFAIL: ${(err as Error).constructor.name}: ${(err as Error).message}`,
    );
} finally {
    await client.close();
}
