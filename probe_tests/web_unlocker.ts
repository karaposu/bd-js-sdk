import 'dotenv/config';
import { bdclient } from '../src/index';

function preview(val: unknown, maxLen = 500): string {
    const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '\n... (truncated)' : str;
}

async function main() {
    const client = new bdclient({ autoCreateZones: false });

    try {
        // 1. Raw HTML
        console.log('--- scrapeUrl (raw HTML) ---');
        console.log('📡 https://example.com');
        let t = Date.now();
        const html = await client.scrapeUrl('https://example.com');
                               
        console.log(`⏱  ${Date.now() - t}ms | type: ${typeof html} | len: ${String(html).length}`);
        console.log(preview(html));
        console.log();

        // 2. JSON format
        console.log('--- scrapeUrl (format: json) ---');
        console.log('📡 https://example.com');
        t = Date.now();
        const json = await client.scrapeUrl('https://example.com', { format: 'json' });
        console.log(`⏱  ${Date.now() - t}ms | type: ${typeof json}`);
        console.log(preview(json));
        console.log();

        // 3. Markdown
        console.log('--- scrapeUrl (dataFormat: markdown) ---');
        console.log('📡 https://example.com');
        t = Date.now();
        const md = await client.scrapeUrl('https://example.com', { dataFormat: 'markdown' });
        console.log(`⏱  ${Date.now() - t}ms | type: ${typeof md} | len: ${String(md).length}`);
        console.log(preview(md));
        console.log();

        // 4. Batch
        const urls = ['https://example.com', 'https://httpbin.org/html'];
        console.log('--- scrapeUrl (batch) ---');
        console.log(`📡 ${urls.length} URLs: ${urls.join(', ')}`);
        t = Date.now();
        const batch = await client.scrapeUrl(urls);
        console.log(`⏱  ${Date.now() - t}ms | results: ${(batch as unknown[]).length}`);
        (batch as unknown[]).forEach((r, i) => {
            console.log(`\n[${i}] ${preview(r, 300)}`);
        });
        console.log();

        console.log('✅ All done');
    } catch (err) {
        console.error('❌ Error:', err);
        process.exitCode = 1;
    } finally {
        await client.close();
    }
}

main();
