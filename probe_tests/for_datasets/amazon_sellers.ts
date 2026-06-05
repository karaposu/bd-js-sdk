// Run: npx tsx probe_tests/for_datasets/amazon_sellers.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "rating", operator: ">=", value: 4.5 };

probeDataset(
    'Amazon Sellers',
    (c) => c.datasets.amazonSellers,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
