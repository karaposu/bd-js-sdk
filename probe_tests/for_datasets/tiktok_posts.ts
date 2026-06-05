// Run: npx tsx probe_tests/for_datasets/tiktok_posts.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "views", operator: ">=", value: 10000 };

probeDataset(
    'TikTok Posts',
    (c) => c.datasets.tiktokPosts,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
