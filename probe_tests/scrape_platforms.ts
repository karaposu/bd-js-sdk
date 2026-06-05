import 'dotenv/config';
import { bdclient } from '../src/index';

function preview(val: unknown, maxLen = 400): string {
    const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '\n... (truncated)' : str;
}

async function probe(label: string, fn: () => Promise<unknown>) {
    console.log(`\n=== ${label} ===`);
    const t = Date.now();
    try {
        const result = await fn();
        const ms = Date.now() - t;
        if (typeof result === 'string') {
            console.log(`time: ${ms}ms | type: string | len: ${result.length}`);
            // try parse as JSON to show meaningful fields
            try {
                const parsed = JSON.parse(result);
                const rows = Array.isArray(parsed) ? parsed : [parsed];
                console.log(`rows: ${rows.length}`);
                console.log(preview(rows[0]));
            } catch {
                console.log(preview(result));
            }
        } else if (Array.isArray(result)) {
            console.log(`time: ${ms}ms | rows: ${result.length}`);
            if (result[0]) console.log(preview(result[0]));
        } else {
            console.log(`time: ${ms}ms | type: ${typeof result}`);
            console.log(preview(result));
        }
    } catch (err) {
        console.log(`time: ${Date.now() - t}ms | ERROR`);
        console.log(`  ${(err as Error).constructor.name}: ${(err as Error).message}`);
    }
}

async function main() {
    const client = new bdclient({ autoCreateZones: false });

    try {
        // LinkedIn — profile collect (sync)
        await probe('LinkedIn collectProfiles', () =>
            client.scrape.linkedin.collectProfiles(
                ['https://www.linkedin.com/in/satyanadella/'],
                { format: 'json' },
            ),
        );

        // TikTok — profile collect (sync)
        await probe('TikTok collectProfiles', () =>
            client.scrape.tiktok.collectProfiles(
                ['https://www.tiktok.com/@tiktok'],
                { format: 'json' },
            ),
        );

        // YouTube — video collect (sync)
        await probe('YouTube collectVideos', () =>
            client.scrape.youtube.collectVideos(
                ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
                { format: 'json' },
            ),
        );

        // Reddit — post collect (sync)
        await probe('Reddit collectPosts', () =>
            client.scrape.reddit.collectPosts(
                ['https://www.reddit.com/r/technology/top/'],
                { format: 'json' },
            ),
        );

        // Amazon — product collect (sync)
        await probe('Amazon collectProducts', () =>
            client.scrape.amazon.collectProducts(
                ['https://www.amazon.com/dp/B0D77BX8Y4'],
                { format: 'json' },
            ),
        );

        // Instagram — profile collect (sync)
        await probe('Instagram collectProfiles', () =>
            client.scrape.instagram.collectProfiles(
                ['https://www.instagram.com/natgeo/'],
                { format: 'json' },
            ),
        );

        console.log('\n\ndone');
    } catch (err) {
        console.error('Fatal:', err);
        process.exitCode = 1;
    } finally {
        await client.close();
    }
}

main();
