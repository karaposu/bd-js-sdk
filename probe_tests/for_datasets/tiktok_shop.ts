// Run: npx tsx probe_tests/for_datasets/tiktok_shop.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "price", operator: ">=", value: 10 };

probeDataset(
    'TikTok Shop',
    (c) => c.datasets.tiktokShop,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
