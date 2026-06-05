// Run: npx tsx probe_tests/for_datasets/amazon_products_search.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "title", operator: "includes", value: "keyboard" };

probeDataset(
    'Amazon Products Search',
    (c) => c.datasets.amazonProductsSearch,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
