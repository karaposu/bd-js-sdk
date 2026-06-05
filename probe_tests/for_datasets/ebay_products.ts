// Run: npx tsx probe_tests/for_datasets/ebay_products.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "title", operator: "includes", value: "laptop" };

probeDataset(
    'eBay Products',
    (c) => c.datasets.ebayProducts,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
