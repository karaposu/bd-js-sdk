// Run: npx tsx probe_tests/for_datasets/target_products.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "name", operator: "includes", value: "Apple" };

probeDataset(
    'Target Products',
    (c) => c.datasets.targetProducts,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
