// Run: npx tsx probe_tests/for_datasets/yelp_businesses.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "overall_rating", operator: ">=", value: 4 };

probeDataset(
    'Yelp Businesses',
    (c) => c.datasets.yelpBusinesses,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
