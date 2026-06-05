// Run: npx tsx probe_tests/for_datasets/youtube_comments.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "likes", operator: ">=", value: 100 };

probeDataset(
    'YouTube Comments',
    (c) => c.datasets.youtubeComments,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
