import 'dotenv/config';
import { bdclient } from '../src/index';

function printSerpResults(response: unknown) {
    if (typeof response === 'string') {
        console.log('  [raw HTML, length:', response.length, 'chars]');
        return;
    }

    const res = response as {
        status_code: number;
        headers: Record<string, string>;
        body: string;
    };

    console.log(`  status: ${res.status_code}`);

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(res.body);
    } catch {
        console.log('  [body is not JSON, length:', res.body?.length, 'chars]');
        return;
    }

    // General info
    const general = parsed.general as Record<string, unknown> | undefined;
    if (general) {
        console.log(`  results_count: ${general.results_cnt}`);
        console.log(`  search_engine: ${general.search_engine}`);
    }

    // Organic results
    const organic = parsed.organic as Array<Record<string, unknown>> | undefined;
    if (organic?.length) {
        console.log(`\n  --- organic results (${organic.length}) ---`);
        organic.forEach((r, i) => {
            console.log(`  [${i + 1}] ${r.title}`);
            console.log(`      ${r.link}`);
            if (r.description) console.log(`      ${(r.description as string).slice(0, 150)}`);
        });
    }

    // Related queries
    const related = parsed.related as Array<Record<string, unknown>> | undefined;
    if (related?.length) {
        console.log(`\n  --- related queries (${related.length}) ---`);
        related.forEach((r) => console.log(`  - ${r.text || r.query}`));
    }

    // Snack pack (local results) — just names, no images
    const snackPack = parsed.snack_pack as Array<Record<string, unknown>> | undefined;
    if (snackPack?.length) {
        console.log(`\n  --- snack pack (${snackPack.length}) ---`);
        snackPack.forEach((r) => {
            console.log(`  - ${r.title}${r.rating ? ` (${r.rating}⭐)` : ''}`);
        });
    }

    // Pagination
    const pagination = parsed.pagination as Record<string, unknown> | undefined;
    if (pagination) {
        console.log(`\n  --- pagination ---`);
        console.log(`  current: ${pagination.current}, pages: ${Object.keys(pagination).filter(k => k !== 'current').length}`);
    }
}

async function main() {
    const client = new bdclient({ autoCreateZones: false });

    try {
        // 1. Google JSON
        console.log('=== search.google (format: json) ===');
        console.log('query: "bright data web scraping"');
        let t = Date.now();
        const result = await client.search.google('bright data web scraping', { format: 'json' });
        console.log(`time: ${Date.now() - t}ms`);
        printSerpResults(result);
        console.log();

        // 2. Batch JSON
        const queries = ['pizza restaurants', 'sushi restaurants'];
        console.log('=== search.google batch (format: json) ===');
        console.log(`queries: ${queries.join(', ')}`);
        t = Date.now();
        const batch = await client.search.google(queries, { format: 'json' });
        console.log(`time: ${Date.now() - t}ms | count: ${(batch as unknown[]).length}`);
        (batch as unknown[]).forEach((r, i) => {
            console.log(`\n--- [${i}] "${queries[i]}" ---`);
            printSerpResults(r);
        });
        console.log();

        console.log('done');
    } catch (err) {
        console.error('Error:', err);
        process.exitCode = 1;
    } finally {
        await client.close();
    }
}

main();
