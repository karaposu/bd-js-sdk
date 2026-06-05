// Run: npx tsx probe_tests/for_datasets/google_maps_reviews.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "review_rating", operator: ">=", value: 4 };

probeDataset(
    'Google Maps Reviews',
    (c) => c.datasets.googleMapsReviews,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
