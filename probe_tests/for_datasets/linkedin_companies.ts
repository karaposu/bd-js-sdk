// Run: npx tsx probe_tests/for_datasets/linkedin_companies.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "company_size", operator: "=", value: "1001-5000 employees" };

probeDataset(
    'LinkedIn Companies',
    (c) => c.datasets.linkedinCompanies,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
