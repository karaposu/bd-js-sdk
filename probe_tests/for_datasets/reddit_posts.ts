// Run: npx tsx probe_tests/for_datasets/reddit_posts.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "upvotes", operator: ">=", value: 1000 };

probeDataset(
    'Reddit Posts',
    (c) => c.datasets.redditPosts,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
