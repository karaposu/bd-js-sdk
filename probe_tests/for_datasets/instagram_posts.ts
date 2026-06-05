// Run: npx tsx probe_tests/for_datasets/instagram_posts.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "likes_count", operator: ">=", value: 1000 };

probeDataset(
    'Instagram Posts',
    (c) => c.datasets.instagramPosts,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
