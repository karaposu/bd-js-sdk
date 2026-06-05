// Run: npx tsx probe_tests/for_datasets/sample_urls.ts [test_name]
// Samples a dataset using its filter, extracts a URL, and writes it into the probe test file.
//
// Examples:
//   npx tsx probe_tests/for_datasets/sample_urls.ts amazon_reviews
//   npx tsx probe_tests/for_datasets/sample_urls.ts all
//
// What it does:
//   1. Reads the probe test file to get the filter and dataset accessor
//   2. Runs the filter query with records_limit=1
//   3. Waits for the snapshot and downloads it
//   4. Extracts the URL from the first record
//   5. Writes SAMPLE_URL into the probe test file

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { bdclient } from '../../src/index';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SKIP = new Set(['_helper.ts', 'sample_urls.ts', '0.ts', 'agent_check.md']);
const MAX_WAIT = 180_000;
const POLL_INTERVAL = 5_000;

function getTestFiles(): string[] {
    return fs.readdirSync(DIR)
        .filter(f => f.endsWith('.ts') && !SKIP.has(f))
        .sort();
}

async function waitForSnapshot(
    ds: { getStatus: (id: string) => Promise<{ status: string }>; download: (id: string) => Promise<unknown[]> },
    snapshotId: string,
): Promise<unknown[]> {
    const start = Date.now();
    for (;;) {
        const { status } = await ds.getStatus(snapshotId);
        const elapsed = Math.round((Date.now() - start) / 1000);
        process.stdout.write(`\r  polling: ${status} (${elapsed}s)`);

        if (status === 'ready') {
            process.stdout.write('\n');
            return ds.download(snapshotId);
        }
        if (status === 'failed' || status === 'error') {
            process.stdout.write('\n');
            throw new Error(`Snapshot failed: ${status}`);
        }
        if (Date.now() - start > MAX_WAIT) {
            process.stdout.write('\n');
            throw new Error(`Timed out after ${MAX_WAIT / 1000}s`);
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
}

function parseTestFile(filePath: string) {
    const src = fs.readFileSync(filePath, 'utf8');

    // Extract FILTER
    const filterMatch = src.match(/const FILTER\s*=\s*(\{[^}]+\})/);
    if (!filterMatch) throw new Error('Could not parse FILTER');

    // Extract urlField
    const urlFieldMatch = src.match(/urlField:\s*['"]([^'"]+)['"]/);
    const urlField = urlFieldMatch?.[1] ?? 'url';

    // Extract dataset accessor: (c) => c.datasets.XXX
    const dsMatch = src.match(/c\.datasets\.(\w+)/);
    if (!dsMatch) throw new Error('Could not parse dataset accessor');

    // eval the filter object
    const filter = new Function(`return (${filterMatch[1]})`)() as Record<string, unknown>;

    return { filter, urlField, datasetKey: dsMatch[1], src };
}

function writeSampleUrl(filePath: string, src: string, sampleUrl: string) {
    let updated: string;
    if (src.includes('const SAMPLE_URL')) {
        // Replace existing
        updated = src.replace(/const SAMPLE_URL\s*=\s*['"][^'"]*['"];?/, `const SAMPLE_URL = '${sampleUrl}';`);
    } else {
        // Insert after FILTER line
        updated = src.replace(
            /(const FILTER\s*=\s*\{[^}]+\};?)/,
            `$1\nconst SAMPLE_URL = '${sampleUrl}';`,
        );
    }
    fs.writeFileSync(filePath, updated, 'utf8');
}

async function sampleOne(testName: string) {
    const fileName = testName.endsWith('.ts') ? testName : `${testName}.ts`;
    const filePath = path.join(DIR, fileName);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${fileName}`);
        return false;
    }

    console.log(`\n=== ${testName} ===`);

    const { filter, urlField, datasetKey, src } = parseTestFile(filePath);
    console.log(`  dataset: ${datasetKey}`);
    console.log(`  filter: ${JSON.stringify(filter)}`);
    console.log(`  urlField: ${urlField}`);

    const client = new bdclient({ autoCreateZones: false });
    try {
        const ds = (client.datasets as Record<string, any>)[datasetKey];
        if (!ds) {
            console.error(`  Dataset accessor "datasets.${datasetKey}" not found`);
            return false;
        }

        const snapshotId = await ds.query(filter, { records_limit: 1 });
        console.log(`  snapshot: ${snapshotId}`);

        const data = await waitForSnapshot(ds, snapshotId);
        if (!data[0]) {
            console.error('  No data returned');
            return false;
        }

        const record = data[0] as Record<string, unknown>;
        let url = record[urlField] as string;
        if (!url || typeof url !== 'string') {
            const alt = (record['link'] ?? record['input_url'] ?? record['page_url']) as string;
            if (alt && typeof alt === 'string') {
                console.log(`  "${urlField}" not found, using fallback field → ${alt}`);
                url = alt;
            } else {
                console.log(`  No URL found. Fields: ${Object.keys(record).join(', ')}`);
                return false;
            }
        }

        console.log(`  extracted: ${url}`);
        writeSampleUrl(filePath, src, url);
        console.log(`  written to ${fileName}`);
        return true;
    } catch (err) {
        console.error(`  FAIL: ${(err as Error).message}`);
        return false;
    } finally {
        await client.close();
    }
}

// --- Main ---
const arg = process.argv[2];

if (!arg) {
    console.log('Usage: npx tsx probe_tests/for_datasets/sample_urls.ts <test_name|all>');
    console.log('\nAvailable tests:');
    for (const f of getTestFiles()) {
        console.log(`  ${f.replace('.ts', '')}`);
    }
    process.exit(0);
}

if (arg === 'all') {
    const files = getTestFiles();
    let pass = 0, fail = 0;
    for (const f of files) {
        const ok = await sampleOne(f.replace('.ts', ''));
        if (ok) pass++; else fail++;
    }
    console.log(`\n--- Done: ${pass} pass, ${fail} fail ---`);
} else {
    await sampleOne(arg);
}
