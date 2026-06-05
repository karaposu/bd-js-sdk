// Run: npx tsx probe_tests/for_datasets/amazon_walmart.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "name", operator: "includes", value: "Apple" };

probeDataset(
    'Amazon Walmart',
    (c) => c.datasets.amazonWalmart,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
