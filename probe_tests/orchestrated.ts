import 'dotenv/config';
import { bdclient } from '../src/index';
import type { ScrapeResult } from '../src/models/result';

function preview(val: unknown, maxLen = 400): string {
    const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '\n... (truncated)' : str;
}

function printResult(label: string, result: ScrapeResult) {
    console.log(`\n--- ${label} ---`);
    console.log('success:', result.success);
    console.log('status:', result.status);
    console.log('snapshotId:', result.snapshotId);
    console.log('platform:', result.platform);
    console.log('rowCount:', result.rowCount);
    console.log('elapsed:', result.elapsedMs(), 'ms');
    console.log('timing:', result.getTimingBreakdown());
    if (result.data) {
        const rows = Array.isArray(result.data) ? result.data : [result.data];
        console.log(`data rows: ${rows.length}`);
        if (rows[0]) console.log('first row:', preview(rows[0]));
    }
    if (result.error) {
        console.log('error:', result.error);
    }
}

async function main() {
    const client = new bdclient({ autoCreateZones: false });
    const opts = { pollInterval: 5000, pollTimeout: 180_000 };

    try {
        // Pick one platform to run end-to-end through orchestrate → ScrapeResult
        console.log('=== Orchestrated: LinkedIn profiles ===');
        console.log('This triggers async, polls until ready, fetches data.');
        console.log('Expect ~30-120s...\n');

        const t = Date.now();
        const result = await client.scrape.linkedin.profiles(
            ['https://www.linkedin.com/in/satyanadella/'],
            opts,
        );
        console.log(`total wall time: ${Date.now() - t}ms`);
        printResult('LinkedIn profiles()', result);

        // Print the full toString() for visual check
        console.log('\n--- toString() ---');
        console.log(result.toString());

        console.log('\n\ndone');
    } catch (err) {
        console.error('Error:', (err as Error).constructor.name, (err as Error).message);
        process.exitCode = 1;
    } finally {
        await client.close();
    }
}

main();
