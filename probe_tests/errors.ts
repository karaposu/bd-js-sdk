import 'dotenv/config';
import { bdclient, ValidationError, BRDError } from '../src/index';

function check(label: string, fn: () => unknown) {
    console.log(`\n--- ${label} ---`);
    try {
        fn();
        console.log('  no error (unexpected)');
    } catch (err) {
        const e = err as Error;
        console.log(`  ${e.constructor.name}: ${e.message}`);
    }
}

async function checkAsync(label: string, fn: () => Promise<unknown>) {
    console.log(`\n--- ${label} ---`);
    try {
        await fn();
        console.log('  no error (unexpected)');
    } catch (err) {
        const e = err as Error;
        console.log(`  ${e.constructor.name}: ${e.message}`);
    }
}

async function main() {
    console.log('=== Error Classification ===');

    // Sync validation errors
    check('API key too short', () =>
        new bdclient({ apiKey: 'short' }),
    );

    check('Timeout below minimum', () =>
        new bdclient({ apiKey: 'test_token_1234567890abcdef', timeout: 50 }),
    );

    check('Timeout above maximum', () =>
        new bdclient({ apiKey: 'test_token_1234567890abcdef', timeout: 999_999 }),
    );

    // Async validation errors
    const client = new bdclient({ autoCreateZones: false });

    await checkAsync('Invalid URL', () =>
        client.scrapeUrl('not-a-url'),
    );

    // Auth error — wrong key hits API
    const badClient = new bdclient({
        apiKey: 'brd_000000000000000000000fake',
        autoCreateZones: false,
    });
    await checkAsync('Wrong API key → AuthenticationError', () =>
        badClient.scrapeUrl('https://example.com'),
    );
    await badClient.close();

    // Request after close
    await client.close();
    await checkAsync('Request after close()', () =>
        client.scrapeUrl('https://example.com'),
    );

    console.log('\n\ndone');
}

main();
