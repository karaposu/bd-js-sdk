// Run: npx tsx probe_tests/for_datasets/walmart_products.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "name", operator: "includes", value: "Apple" };

probeDataset(
    'Walmart Products',
    (c) => c.datasets.walmartProducts,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
