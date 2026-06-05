import 'dotenv/config';
import { bdclient } from '../src/index';

async function main() {
    // 1. Lazy init + Object.keys
    console.log('=== Lazy Init ===');
    const client = new bdclient({ autoCreateZones: false });
    const keys = Object.keys(client);
    console.log('Object.keys(client):', keys);
    console.log('has scrape:', keys.includes('scrape'));
    console.log('has search:', keys.includes('search'));
    console.log('has datasets:', keys.includes('datasets'));

    console.log('\nAccessing client.scrape...');
    const scrape = client.scrape;
    console.log('scrape platforms:', Object.keys(scrape));
    console.log('same instance?', client.scrape === scrape);

    console.log('\nAccessing client.datasets...');
    const ds = client.datasets;
    console.log('datasets type:', ds.constructor.name);
    console.log('same instance?', client.datasets === ds);

    // 2. Zones
    try {
        console.log('\n=== listZones ===');
        const t = Date.now();
        const zones = await client.listZones();
        console.log(`time: ${Date.now() - t}ms | count: ${zones.length}`);
        zones.slice(0, 5).forEach((z, i) => {
            console.log(`  [${i}] ${z.name} | type: ${(z as Record<string, unknown>).type ?? '?'} | status: ${(z as Record<string, unknown>).status ?? '?'}`);
        });
        if (zones.length > 5) console.log(`  ... and ${zones.length - 5} more`);
    } catch (err) {
        console.error('zones error:', (err as Error).constructor.name, (err as Error).message);
    }

    // 3. Close + request-after-close
    await client.close();
    console.log('\n=== Request after close ===');
    try {
        await client.scrapeUrl('https://example.com');
        console.log('ERROR: should have thrown');
    } catch (err) {
        console.log('caught:', (err as Error).constructor.name, '—', (err as Error).message);
    }

    console.log('\ndone');
}

main();
