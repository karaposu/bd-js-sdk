// Run: npx tsx probe_tests/for_datasets/youtube_videos.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "views", operator: ">=", value: 100000 };

probeDataset(
    'YouTube Videos',
    (c) => c.datasets.youtubeVideos,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
