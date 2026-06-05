import 'dotenv/config';
import { bdclient } from '../src/index';

function preview(val: unknown, maxLen = 400): string {
    const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '\n... (truncated)' : str;
}

async function main() {
    const client = new bdclient({ autoCreateZones: false });

    try {
        // 1. Verify all 19 dataset getters resolve (instant, no API calls)
        console.log('=== All dataset getters ===');
        const ds = client.datasets;
        const all = [
            ds.linkedinProfiles, ds.linkedinCompanies,
            ds.amazonProducts, ds.amazonReviews, ds.amazonSellers,
            ds.amazonBestSellers, ds.amazonProductsSearch,
            ds.amazonProductsGlobal, ds.amazonWalmart,
            ds.instagramProfiles, ds.instagramPosts,
            ds.instagramComments, ds.instagramReels,
            ds.tiktokProfiles, ds.tiktokPosts,
            ds.tiktokComments, ds.tiktokShop,
            ds.xTwitterPosts, ds.xTwitterProfiles,
        ];
        console.log(`total: ${all.length} datasets`);
        for (const d of all) {
            console.log(`  ${d.name} → ${d.datasetId}`);
        }

        // 2. list() — what datasets does the account have access to?
        console.log('\n=== datasets.list() ===');
        let t = Date.now();
        const list = await ds.list();
        console.log(`time: ${Date.now() - t}ms | count: ${list.length}`);
        list.slice(0, 10).forEach((d, i) => {
            console.log(`  [${i}] ${d.id} — ${d.name}${d.records_count ? ` (${d.records_count} records)` : ''}`);
        });
        if (list.length > 10) console.log(`  ... and ${list.length - 10} more`);

        // 3. getMetadata() — field schemas for a few platforms
        console.log('\n=== getMetadata() ===');
        for (const dataset of [ds.instagramProfiles, ds.tiktokPosts, ds.amazonProducts]) {
            t = Date.now();
            try {
                const meta = await dataset.getMetadata();
                console.log(`\n${dataset.name}: ${Date.now() - t}ms | fields: ${meta.fields.length}`);
                meta.fields.slice(0, 8).forEach(f => {
                    console.log(`  ${f.name} (${f.type})${f.description ? ' — ' + f.description.slice(0, 80) : ''}`);
                });
                if (meta.fields.length > 8) console.log(`  ... and ${meta.fields.length - 8} more fields`);
            } catch (err) {
                console.log(`\n${dataset.name}: ${Date.now() - t}ms | ERROR: ${(err as Error).message}`);
            }
        }

        // 4. query() + getStatus() — trigger a snapshot (don't wait for full download)
        console.log('\n=== query() + getStatus() ===');
        t = Date.now();
        try {
            const snapshotId = await ds.instagramProfiles.query(
                { url: 'https://www.instagram.com/natgeo/' },
                { records_limit: 1 },
            );
            console.log(`query time: ${Date.now() - t}ms`);
            console.log(`snapshot_id: ${snapshotId}`);

            const status = await ds.instagramProfiles.getStatus(snapshotId);
            console.log(`status: ${status.status} | progress: ${status.progress ?? 'n/a'} | records: ${status.records_count ?? 'n/a'}`);

            // If it's already ready (unlikely but possible), show data
            if (status.status === 'ready') {
                const data = await ds.instagramProfiles.download(snapshotId);
                console.log(`download rows: ${data.length}`);
                if (data[0]) console.log('first row:', preview(data[0]));
            } else {
                console.log('(snapshot still processing — skipping download for speed)');
            }
        } catch (err) {
            console.log(`query error: ${(err as Error).constructor.name}: ${(err as Error).message}`);
        }

        console.log('\n\ndone');
    } catch (err) {
        console.error('Fatal:', err);
        process.exitCode = 1;
    } finally {
        await client.close();
    }
}

main();
