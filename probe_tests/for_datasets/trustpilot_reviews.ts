// Run: npx tsx probe_tests/for_datasets/trustpilot_reviews.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "review_rating", operator: ">=", value: 4 };

probeDataset(
    'Trustpilot Reviews',
    (c) => c.datasets.trustpilotReviews,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
