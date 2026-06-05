// Run: npx tsx probe_tests/for_datasets/glassdoor_reviews.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "rating_overall", operator: ">=", value: 4 };

probeDataset(
    'Glassdoor Reviews',
    (c) => c.datasets.glassdoorReviews,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
