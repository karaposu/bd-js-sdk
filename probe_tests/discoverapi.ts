// Run: npx tsx probe_tests/discoverapi.ts
import 'dotenv/config';
import { bdclient } from '../src/index';

const client = new bdclient({ autoCreateZones: false });

function preview(val: unknown, maxLen = 200): string {
    const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

async function test1_basicSearch() {
    console.log('\n=== Test 1: Basic Discover Search ===');
    const query = 'artificial intelligence trends 2026';
    console.log(`Query: "${query}"\n`);

    const result = await client.discover(query);

    console.log(`Success: ${result.success}`);
    console.log(`Total Results: ${result.totalResults}`);
    console.log(`Task ID: ${result.taskId}`);
    console.log(`Duration: ${result.durationSeconds ?? 'N/A'}s`);

    if (result.success && result.data) {
        console.log('\n--- Top 5 Results ---');
        for (const [i, item] of result.data.slice(0, 5).entries()) {
            console.log(`\n${i + 1}. [${item.relevance_score.toFixed(2)}] ${item.title}`);
            console.log(`   URL: ${item.link}`);
            console.log(`   ${preview(item.description, 80)}`);
        }
    } else {
        console.log(`\nError: ${result.error}`);
    }

    return result;
}

async function test2_searchWithIntent() {
    console.log('\n=== Test 2: Search with Intent ===');
    const query = 'Tesla battery technology';
    const intent = 'recent breakthroughs in EV battery chemistry';
    console.log(`Query: "${query}"`);
    console.log(`Intent: "${intent}"\n`);

    const result = await client.discover(query, { intent });

    console.log(`Success: ${result.success}`);
    console.log(`Total Results: ${result.totalResults}`);

    if (result.success && result.data) {
        console.log('\n--- Results ranked by relevance to intent ---');
        for (const [i, item] of result.data.slice(0, 5).entries()) {
            console.log(`\n${i + 1}. [${item.relevance_score.toFixed(4)}] ${item.title}`);
            console.log(`   ${item.link}`);
        }
    } else {
        console.log(`\nError: ${result.error}`);
    }

    return result;
}

async function test3_filterAndLocalization() {
    console.log('\n=== Test 3: Filter Keywords & Localization ===');
    const query = 'sustainable fashion brands';
    const intent = 'eco-friendly clothing companies';
    const filterKeywords = ['sustainability', 'eco-friendly', 'organic'];
    console.log(`Query: "${query}"`);
    console.log(`Intent: "${intent}"`);
    console.log(`Filter Keywords: ${JSON.stringify(filterKeywords)}`);
    console.log(`Country: us\n`);

    const result = await client.discover(query, {
        intent,
        filterKeywords,
        country: 'us',
        numResults: 10,
    });

    console.log(`Success: ${result.success}`);
    console.log(`Total Results: ${result.totalResults}`);

    if (result.success && result.data) {
        console.log('\n--- Filtered Results ---');
        for (const [i, item] of result.data.slice(0, 5).entries()) {
            console.log(`\n${i + 1}. [${item.relevance_score.toFixed(2)}] ${item.title}`);
            console.log(`   ${item.link}`);
        }
    } else {
        console.log(`\nError: ${result.error}`);
    }

    return result;
}

async function test4_includeContent() {
    console.log('\n=== Test 4: Include Page Content ===');
    const query = 'python asyncio tutorial';
    const intent = 'beginner-friendly guide to async programming in Python';
    console.log(`Query: "${query}"`);
    console.log(`Intent: "${intent}"`);
    console.log('Include Content: true\n');

    const result = await client.discover(query, {
        intent,
        includeContent: true,
        numResults: 3,
    });

    console.log(`Success: ${result.success}`);
    console.log(`Total Results: ${result.totalResults}`);

    if (result.success && result.data) {
        for (const [i, item] of result.data.entries()) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`${i + 1}. [${item.relevance_score.toFixed(2)}] ${item.title}`);
            console.log(`   URL: ${item.link}`);
            if (item.content) {
                console.log(`   Content preview: ${preview(item.content.replace(/\n/g, ' '), 200)}`);
            } else {
                console.log('   Content: None');
            }
        }
    } else {
        console.log(`\nError: ${result.error}`);
    }

    return result;
}

async function test5_manualTriggerPollFetch() {
    console.log('\n=== Test 5: Manual Trigger / Poll / Fetch ===');
    const query = 'market research SaaS pricing 2026';
    const intent = 'competitor pricing strategies for B2B SaaS';
    console.log(`Query: "${query}"`);
    console.log(`Intent: "${intent}"\n`);

    // Step 1: Trigger
    const job = await client.discoverTrigger(query, {
        intent,
        numResults: 5,
    });
    console.log(`Step 1 - Triggered: ${job}`);
    console.log(`   Task ID: ${job.taskId}`);

    // Step 2: Check status
    const status = await job.status();
    console.log(`\nStep 2 - Status: ${status}`);

    // Step 3: Wait
    console.log('\nStep 3 - Waiting for results...');
    const finalStatus = await job.wait({ timeout: 60_000, pollInterval: 2_000 });
    console.log(`   Final status: ${finalStatus}`);

    // Step 4: Fetch
    const data = await job.fetch();
    console.log(`\nStep 4 - Fetched ${data.length} results`);

    for (const [i, item] of data.entries()) {
        console.log(`\n  ${i + 1}. [${item.relevance_score.toFixed(2)}] ${item.title}`);
        console.log(`     ${item.link}`);
    }
}

async function test6_timingMetadata(result: { success: boolean; query: string; intent: string | null; totalResults: number | null; durationSeconds: number | null; taskId: string | null; triggerSentAt: Date | null; dataFetchedAt: Date | null; elapsedMs: () => number | null }) {
    console.log('\n=== Test 6: Timing Metadata ===');
    console.log(`success: ${result.success}`);
    console.log(`query: ${result.query}`);
    console.log(`intent: ${result.intent}`);
    console.log(`total_results: ${result.totalResults}`);
    console.log(`duration_seconds: ${result.durationSeconds}`);
    console.log(`task_id: ${result.taskId}`);
    console.log(`\ntrigger_sent_at: ${result.triggerSentAt?.toISOString()}`);
    console.log(`data_fetched_at: ${result.dataFetchedAt?.toISOString()}`);

    const elapsed = result.elapsedMs();
    if (elapsed) {
        console.log(`\nTotal time: ${(elapsed / 1000).toFixed(2)} seconds`);
    }
}

// --- Run all tests ---
try {
    const r1 = await test1_basicSearch();
    const r2 = await test2_searchWithIntent();
    await test3_filterAndLocalization();
    await test4_includeContent();
    await test5_manualTriggerPollFetch();
    await test6_timingMetadata(r2);

    console.log('\n\nALL TESTS PASSED');
} catch (err) {
    console.error(`\nFAIL: ${(err as Error).constructor.name}: ${(err as Error).message}`);
} finally {
    await client.close();
}
