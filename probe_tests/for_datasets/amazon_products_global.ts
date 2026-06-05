// Run: npx tsx probe_tests/for_datasets/amazon_products_global.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "brand", operator: "=", value: "Apple" };

probeDataset(
    'Amazon Products Global',
    (c) => c.datasets.amazonProductsGlobal,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
