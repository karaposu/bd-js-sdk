// Run: npx tsx probe_tests/for_datasets/instagram_reels.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "views", operator: ">=", value: 10000 };

probeDataset(
    'Instagram Reels',
    (c) => c.datasets.instagramReels,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
