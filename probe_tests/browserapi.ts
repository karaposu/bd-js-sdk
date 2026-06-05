// Run: npx tsx probe_tests/browserapi.ts
// Requires: BRIGHTDATA_API_TOKEN, BRIGHTDATA_BROWSERAPI_USERNAME, BRIGHTDATA_BROWSERAPI_PASSWORD in .env
// Requires: playwright installed (npm install playwright)
import 'dotenv/config';
import { bdclient } from '../src/index';

const client = new bdclient();

function maskPassword(url: string): string {
    return url.replace(/:([^@]+)@/, ':****@');
}

async function test1_getConnectUrl() {
    console.log('\n=== Test 1: Get Connection URL ===');

    const url = client.browser.getConnectUrl();

    console.log(`Connection URL: ${maskPassword(url)}`);
    console.log(`Protocol: wss://`);
    console.log(`Host: brd.superproxy.io`);
    console.log(`Port: 9222`);

    return url;
}

async function test2_geoTargetedUrls() {
    console.log('\n=== Test 2: Geo-Targeted URLs ===');

    const countries = ['us', 'gb', 'de', 'jp'];

    for (const country of countries) {
        const url = client.browser.getConnectUrl({ country });
        console.log(`  ${country.toUpperCase()}: ${maskPassword(url)}`);
    }
}

async function test3_connectWithPlaywright() {
    console.log('\n=== Test 3: Connect with Playwright ===');

    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        console.log('  Playwright not installed — skipping');
        console.log('  Install with: npm install playwright');
        return;
    }

    const url = client.browser.getConnectUrl();
    console.log('Connecting to cloud browser...');

    const browser = await chromium.connectOverCDP(url);
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = context.pages()[0] ?? await context.newPage();

    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    const html = await page.content();

    await browser.close();

    console.log(`  Page title: ${title}`);
    console.log(`  HTML length: ${html.length} chars`);
    console.log(`  First 200 chars: ${html.slice(0, 200)}...`);
}

async function test4_screenshot() {
    console.log('\n=== Test 4: Take a Screenshot ===');

    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        console.log('  Playwright not installed — skipping');
        return;
    }

    const url = client.browser.getConnectUrl();
    const screenshotPath = 'probe_tests/browser_screenshot.png';

    console.log('Taking screenshot of example.com...');

    const browser = await chromium.connectOverCDP(url);
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = context.pages()[0] ?? await context.newPage();

    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: screenshotPath });

    await browser.close();

    console.log(`  Screenshot saved: ${screenshotPath}`);
}

async function test5_geoTargetedScrape() {
    console.log('\n=== Test 5: Geo-Targeted Scrape ===');

    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        console.log('  Playwright not installed — skipping');
        return;
    }

    const url = client.browser.getConnectUrl({ country: 'us' });
    const target = 'https://example.com';

    console.log(`Connecting through US proxy...`);
    console.log(`Target: ${target}\n`);

    const browser = await chromium.connectOverCDP(url);
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = context.pages()[0] ?? await context.newPage();

    await page.goto(target, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    const content = await page.textContent('body');

    await browser.close();

    console.log(`  Page title: ${title}`);
    console.log(`  Body text (first 300 chars): ${(content ?? 'N/A').slice(0, 300)}`);
}

async function test6_multiplePages() {
    console.log('\n=== Test 6: Multiple Pages ===');

    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        console.log('  Playwright not installed — skipping');
        return;
    }

    const urls = [
        'https://example.com',
        'https://httpbin.org/html',
    ];

    const results: Array<{ url: string; title: string; htmlLength: number }> = [];

    for (const target of urls) {
        // Fresh connection per URL — Bright Data recommends one connection per navigation
        const connectUrl = client.browser.getConnectUrl();
        console.log(`  Scraping: ${target}`);

        const browser = await chromium.connectOverCDP(connectUrl);
        const context = browser.contexts()[0] ?? await browser.newContext();
        const page = context.pages()[0] ?? await context.newPage();

        await page.goto(target, { waitUntil: 'domcontentloaded' });
        const title = await page.title();
        const html = await page.content();

        await browser.close();

        results.push({ url: target, title, htmlLength: html.length });
        console.log(`    Title: ${title} (${html.length} chars)`);
    }

    console.log(`\n  Scraped ${results.length} pages successfully.`);
}

// --- Run all tests ---
try {
    await test1_getConnectUrl();
    await test2_geoTargetedUrls();
    await test3_connectWithPlaywright();
    await test4_screenshot();
    await test5_geoTargetedScrape();
    await test6_multiplePages();

    console.log('\n\nALL TESTS PASSED');
} catch (err) {
    console.error(
        `\nFAIL: ${(err as Error).constructor.name}: ${(err as Error).message}`,
    );
} finally {
    await client.close();
}
