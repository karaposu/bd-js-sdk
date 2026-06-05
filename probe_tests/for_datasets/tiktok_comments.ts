// Run: npx tsx probe_tests/for_datasets/tiktok_comments.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "likes", operator: ">=", value: 50 };

probeDataset(
    'TikTok Comments',
    (c) => c.datasets.tiktokComments,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
