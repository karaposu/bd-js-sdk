// Run: npx tsx probe_tests/for_datasets/google_maps_full_info.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "title", operator: "includes", value: "restaurant" };

probeDataset(
    'Google Maps Full Info',
    (c) => c.datasets.googleMapsFullInfo,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
