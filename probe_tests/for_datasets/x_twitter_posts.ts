// Run: npx tsx probe_tests/for_datasets/x_twitter_posts.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "likes", operator: ">=", value: 1000 };

probeDataset(
    'X Twitter Posts',
    (c) => c.datasets.xTwitterPosts,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
