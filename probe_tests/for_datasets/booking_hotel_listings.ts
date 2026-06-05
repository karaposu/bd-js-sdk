// Run: npx tsx probe_tests/for_datasets/booking_hotel_listings.ts
import { probeDataset } from './_helper';

const USE_SAMPLE = true;
const FILTER = { name: "location", operator: "includes", value: "Paris" };

probeDataset(
    'Booking Hotel Listings',
    (c) => c.datasets.bookingHotelListings,
    { useSample: USE_SAMPLE, filter: FILTER, urlField: 'url' },
);
