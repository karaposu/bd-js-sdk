import 'dotenv/config';
import { bdclient } from '../../src/index';

export function createClient() {
    return new bdclient({ autoCreateZones: false });
}

export function preview(val: unknown, maxLen = 500): string {
    const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '\n... (truncated)' : str;
}

type Dataset = {
    query: (filter: Record<string, unknown>, opts?: { records_limit?: number }) => Promise<string>;
    sample: (opts?: { records_limit?: number }) => Promise<string>;
    getStatus: (id: string) => Promise<{ status: string }>;
    download: (id: string) => Promise<unknown[]>;
    name: string;
    datasetId: string;
};

interface ProbeConfig {
    useSample: boolean;
    filter: Record<string, unknown>;
    /** Field name that contains the URL in sample records (default: 'url') */
    urlField?: string;
}

async function waitAndDownload(ds: Dataset, snapshotId: string): Promise<unknown[]> {
    const maxWait = 120_000;
    const interval = 5_000;
    const start = Date.now();

    for (;;) {
        const { status } = await ds.getStatus(snapshotId);
        console.log(`  status: ${status} (${Math.round((Date.now() - start) / 1000)}s)`);

        if (status === 'ready') {
            return await ds.download(snapshotId);
        }
        if (status === 'failed' || status === 'error') {
            throw new Error(`Snapshot failed with status: ${status}`);
        }
        if (Date.now() - start > maxWait) {
            throw new Error(`Timed out after ${maxWait / 1000}s`);
        }
        await new Promise((r) => setTimeout(r, interval));
    }
}

export async function probeDataset(
    name: string,
    getDataset: (client: bdclient) => Dataset,
    config: ProbeConfig,
) {
    const client = createClient();
    try {
        const ds = getDataset(client);
        const urlField = config.urlField ?? 'url';
        console.log(`\n=== ${name} ===`);
        console.log(`dataset: ${ds.name} (${ds.datasetId})`);
        console.log(`config: useSample=${config.useSample}`);

        if (config.useSample) {
            // --- Step 1: Sample to get a real record and extract a URL ---
            console.log(`\n--- Step 1: Sample (extract URL from field: "${urlField}") ---`);
            const t = Date.now();
            const sampleId = await ds.query(config.filter, { records_limit: 1 });
            console.log(`  query: ${Date.now() - t}ms → snapshot_id: ${sampleId}`);

            const sampleData = await waitAndDownload(ds, sampleId);
            console.log(`  rows: ${sampleData.length}`);

            if (!sampleData[0]) throw new Error('Sample returned no data');
            const record = sampleData[0] as Record<string, unknown>;
            console.log(`  record:\n${preview(record)}`);

            let targetUrl = record[urlField] as string;
            if (!targetUrl || typeof targetUrl !== 'string') {
                const alt = (record['link'] ?? record['input_url'] ?? record['page_url']) as string;
                if (alt && typeof alt === 'string') {
                    console.log(`  "${urlField}" not found, using fallback → ${alt}`);
                    targetUrl = alt;
                } else {
                    console.log(`  No URL found. Available fields: ${Object.keys(record).join(', ')}`);
                    console.log('\nPASS (sample only — no URL to re-query)');
                    return;
                }
            }
            console.log(`  extracted URL: ${targetUrl}`);

            // --- Step 2: Re-query with the extracted URL ---
            console.log(`\n--- Step 2: Query with extracted URL ---`);
            const t2 = Date.now();
            const queryId = await ds.query({ name: urlField, operator: '=', value: targetUrl }, { records_limit: 1 });
            console.log(`  query: ${Date.now() - t2}ms → snapshot_id: ${queryId}`);

            const result = await waitAndDownload(ds, queryId);
            console.log(`  rows: ${result.length}`);
            if (result[0]) console.log(`  result:\n${preview(result[0])}`);
        } else {
            // --- Direct query with filter ---
            console.log(`\n--- Direct query ---`);
            console.log(`  filter: ${JSON.stringify(config.filter)}`);
            const t = Date.now();
            const snapshotId = await ds.query(config.filter, { records_limit: 1 });
            console.log(`  query: ${Date.now() - t}ms → snapshot_id: ${snapshotId}`);

            const data = await waitAndDownload(ds, snapshotId);
            console.log(`  rows: ${data.length}`);
            if (data[0]) console.log(`  result:\n${preview(data[0])}`);
        }

        console.log('\nPASS');
    } catch (err) {
        console.error(`\nFAIL: ${(err as Error).constructor.name}: ${(err as Error).message}`);
    } finally {
        await client.close();
    }
}
