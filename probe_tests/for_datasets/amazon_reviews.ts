// Run: npx tsx probe_tests/for_datasets/amazon_reviews.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "rating", operator: ">=", value: 4.5 };

probeDataset(
    'Amazon Reviews',
    (c) => c.datasets.amazonReviews,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
