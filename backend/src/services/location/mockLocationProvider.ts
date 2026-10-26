import {
  ILocationProvider,
  INearbyPlacesQuery,
  INearbyPlacesResult,
  IPlaceResult,
  IGeocodeResult
} from './locationProvider.interface';

/**
 * Calculates geodesic (great-circle) distance between two points in meters using the Haversine formula.
 */
export const calculateHaversineDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const EARTH_RADIUS_METERS = 6371000;
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
};

export const MOCK_HEALTHCARE_PLACES: IPlaceResult[] = [
  {
    placeId: 'mock_hosp_001',
    name: 'Apollo Multispeciality Hospital',
    type: 'hospital',
    types: ['hospital', 'health', 'point_of_interest', 'establishment'],
    address: '21 Greams Lane, Thousand Lights, Chennai, Tamil Nadu 600006',
    vicinity: '21 Greams Lane, Thousand Lights, Chennai',
    formattedAddress: '21 Greams Lane, Thousand Lights, Chennai, Tamil Nadu 600006, India',
    location: {
      type: 'Point',
      coordinates: [80.2518, 13.0604] // [lng, lat]
    },
    latitude: 13.0604,
    longitude: 80.2518,
    rating: 4.8,
    reviewCount: 1420,
    userRatingsTotal: 1420,
    phone: '+91 44 2829 0200',
    internationalPhone: '+91 44 2829 0200',
    website: 'https://www.apollohospitals.com',
    openNow: true,
    businessStatus: 'OPERATIONAL',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Apollo+Multispeciality+Hospital&query_place_id=mock_hosp_001',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=13.0604,80.2518&destination_place_id=mock_hosp_001',
    openingHours: {
      openNow: true,
      weekdayText: [
        'Monday: Open 24 hours',
        'Tuesday: Open 24 hours',
        'Wednesday: Open 24 hours',
        'Thursday: Open 24 hours',
        'Friday: Open 24 hours',
        'Saturday: Open 24 hours',
        'Sunday: Open 24 hours'
      ]
    },
    editorialSummary: 'Prominent multi-specialty tertiary care hospital with 24/7 emergency facilities.'
  },
  {
    placeId: 'mock_hosp_002',
    name: 'Fortis Memorial Research Institute',
    type: 'hospital',
    types: ['hospital', 'health', 'point_of_interest', 'establishment'],
    address: 'Sector 44, Opposite HUDA City Centre, Gurugram, Haryana 122002',
    vicinity: 'Sector 44, Opposite HUDA City Centre, Gurugram',
    formattedAddress: 'Sector 44, Opposite HUDA City Centre, Gurugram, Haryana 122002, India',
    location: {
      type: 'Point',
      coordinates: [77.0727, 28.4595]
    },
    latitude: 28.4595,
    longitude: 77.0727,
    rating: 4.7,
    reviewCount: 980,
    userRatingsTotal: 980,
    phone: '+91 124 4962200',
    internationalPhone: '+91 124 4962200',
    website: 'https://www.fortishealthcare.com',
    openNow: true,
    businessStatus: 'OPERATIONAL',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Fortis+Memorial+Research+Institute&query_place_id=mock_hosp_002',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=28.4595,77.0727&destination_place_id=mock_hosp_002',
    openingHours: {
      openNow: true,
      weekdayText: [
        'Monday: Open 24 hours',
        'Tuesday: Open 24 hours',
        'Wednesday: Open 24 hours',
        'Thursday: Open 24 hours',
        'Friday: Open 24 hours',
        'Saturday: Open 24 hours',
        'Sunday: Open 24 hours'
      ]
    },
    editorialSummary: 'Multi-super speciality quaternary care hospital in Gurugram.'
  },
  {
    placeId: 'mock_hosp_003',
    name: 'AIIMS (All India Institute of Medical Sciences)',
    type: 'hospital',
    types: ['hospital', 'health', 'point_of_interest', 'establishment'],
    address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi, Delhi 110029',
    vicinity: 'Ansari Nagar, New Delhi',
    formattedAddress: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi, Delhi 110029, India',
    location: {
      type: 'Point',
      coordinates: [77.2090, 28.5672]
    },
    latitude: 28.5672,
    longitude: 77.2090,
    rating: 4.6,
    reviewCount: 4250,
    userRatingsTotal: 4250,
    phone: '+91 11 2658 8500',
    internationalPhone: '+91 11 2658 8500',
    website: 'https://www.aiims.edu',
    openNow: true,
    businessStatus: 'OPERATIONAL',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=AIIMS+New+Delhi&query_place_id=mock_hosp_003',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=28.5672,77.2090&destination_place_id=mock_hosp_003',
    openingHours: {
      openNow: true,
      weekdayText: [
        'Monday: Open 24 hours',
        'Tuesday: Open 24 hours',
        'Wednesday: Open 24 hours',
        'Thursday: Open 24 hours',
        'Friday: Open 24 hours',
        'Saturday: Open 24 hours',
        'Sunday: Open 24 hours'
      ]
    },
    editorialSummary: 'Premier public medical research university and hospital in New Delhi.'
  },
  {
    placeId: 'mock_clinic_004',
    name: 'CareFirst Family Health Clinic',
    type: 'clinic',
    types: ['doctor', 'health', 'point_of_interest', 'establishment'],
    address: '45 Connaught Place, Central Delhi, New Delhi, Delhi 110001',
    vicinity: '45 Connaught Place, New Delhi',
    formattedAddress: '45 Connaught Place, Central Delhi, New Delhi, Delhi 110001, India',
    location: {
      type: 'Point',
      coordinates: [77.2167, 28.6328]
    },
    latitude: 28.6328,
    longitude: 77.2167,
    rating: 4.5,
    reviewCount: 230,
    userRatingsTotal: 230,
    phone: '+91 11 2341 5500',
    internationalPhone: '+91 11 2341 5500',
    website: 'https://www.carefirstclinic.mock',
    openNow: true,
    businessStatus: 'OPERATIONAL',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=CareFirst+Family+Health+Clinic&query_place_id=mock_clinic_004',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=28.6328,77.2167&destination_place_id=mock_clinic_004',
    openingHours: {
      openNow: true,
      weekdayText: [
        'Monday: 08:00 AM – 08:00 PM',
        'Tuesday: 08:00 AM – 08:00 PM',
        'Wednesday: 08:00 AM – 08:00 PM',
        'Thursday: 08:00 AM – 08:00 PM',
        'Friday: 08:00 AM – 08:00 PM',
        'Saturday: 08:00 AM – 06:00 PM',
        'Sunday: Closed'
      ]
    },
    editorialSummary: 'Comprehensive outpatient primary care and family medicine clinic.'
  },
  {
    placeId: 'mock_diag_005',
    name: 'Dr. Lal PathLabs Diagnostic Center',
    type: 'diagnostic_center',
    types: ['health', 'point_of_interest', 'establishment'],
    address: '14 Indiranagar 100 Feet Road, Bengaluru, Karnataka 560038',
    vicinity: '14 Indiranagar 100 Feet Road, Bengaluru',
    formattedAddress: '14 Indiranagar 100 Feet Road, Bengaluru, Karnataka 560038, India',
    location: {
      type: 'Point',
      coordinates: [77.6412, 12.9784]
    },
    latitude: 12.9784,
    longitude: 77.6412,
    rating: 4.4,
    reviewCount: 510,
    userRatingsTotal: 510,
    phone: '+91 80 4123 7890',
    internationalPhone: '+91 80 4123 7890',
    website: 'https://www.lalpathlabs.com',
    openNow: true,
    businessStatus: 'OPERATIONAL',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Dr+Lal+PathLabs+Indiranagar&query_place_id=mock_diag_005',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=12.9784,77.6412&destination_place_id=mock_diag_005',
    openingHours: {
      openNow: true,
      weekdayText: [
        'Monday: 06:30 AM – 09:00 PM',
        'Tuesday: 06:30 AM – 09:00 PM',
        'Wednesday: 06:30 AM – 09:00 PM',
        'Thursday: 06:30 AM – 09:00 PM',
        'Friday: 06:30 AM – 09:00 PM',
        'Saturday: 06:30 AM – 09:00 PM',
        'Sunday: 07:00 AM – 02:00 PM'
      ]
    },
    editorialSummary: 'NABL accredited diagnostic laboratory and radiology testing center.'
  },
  {
    placeId: 'mock_pharm_006',
    name: 'MedPlus 24/7 Pharmacy & Wellness',
    type: 'pharmacy',
    types: ['pharmacy', 'health', 'store', 'point_of_interest', 'establishment'],
    address: '78 Bandra Linking Road, Mumbai, Maharashtra 400050',
    vicinity: '78 Bandra Linking Road, Mumbai',
    formattedAddress: '78 Bandra Linking Road, Mumbai, Maharashtra 400050, India',
    location: {
      type: 'Point',
      coordinates: [72.8335, 19.0596]
    },
    latitude: 19.0596,
    longitude: 72.8335,
    rating: 4.3,
    reviewCount: 340,
    userRatingsTotal: 340,
    phone: '+91 22 2640 1234',
    internationalPhone: '+91 22 2640 1234',
    website: 'https://www.medplusmart.com',
    openNow: true,
    businessStatus: 'OPERATIONAL',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=MedPlus+Pharmacy+Bandra&query_place_id=mock_pharm_006',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=19.0596,72.8335&destination_place_id=mock_pharm_006',
    openingHours: {
      openNow: true,
      weekdayText: [
        'Monday: Open 24 hours',
        'Tuesday: Open 24 hours',
        'Wednesday: Open 24 hours',
        'Thursday: Open 24 hours',
        'Friday: Open 24 hours',
        'Saturday: Open 24 hours',
        'Sunday: Open 24 hours'
      ]
    },
    editorialSummary: 'Round-the-clock retail pharmacy offering prescription medications and medical supplies.'
  },
  {
    placeId: 'mock_blood_007',
    name: 'Red Cross Central Blood Bank',
    type: 'blood_bank',
    types: ['health', 'point_of_interest', 'establishment'],
    address: '1 Red Cross Road, Near Central Secretariat, New Delhi, Delhi 110001',
    vicinity: '1 Red Cross Road, New Delhi',
    formattedAddress: '1 Red Cross Road, Near Central Secretariat, New Delhi, Delhi 110001, India',
    location: {
      type: 'Point',
      coordinates: [77.2100, 28.6180]
    },
    latitude: 28.6180,
    longitude: 77.2100,
    rating: 4.9,
    reviewCount: 620,
    userRatingsTotal: 620,
    phone: '+91 11 2371 6441',
    internationalPhone: '+91 11 2371 6441',
    website: 'https://www.indianredcross.org',
    openNow: true,
    businessStatus: 'OPERATIONAL',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Red+Cross+Central+Blood+Bank&query_place_id=mock_blood_007',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=28.6180,77.2100&destination_place_id=mock_blood_007',
    openingHours: {
      openNow: true,
      weekdayText: [
        'Monday: Open 24 hours',
        'Tuesday: Open 24 hours',
        'Wednesday: Open 24 hours',
        'Thursday: Open 24 hours',
        'Friday: Open 24 hours',
        'Saturday: Open 24 hours',
        'Sunday: Open 24 hours'
      ]
    },
    editorialSummary: 'Regional blood transfusion center providing blood components and donation facilities.'
  },
  {
    placeId: 'mock_hosp_008',
    name: 'Max Super Speciality Hospital Saket',
    type: 'hospital',
    types: ['hospital', 'health', 'point_of_interest', 'establishment'],
    address: '1 2, Press Enclave Marg, Saket Institutional Area, Saket, New Delhi, Delhi 110017',
    vicinity: 'Saket Institutional Area, New Delhi',
    formattedAddress: '1 2, Press Enclave Marg, Saket, New Delhi, Delhi 110017, India',
    location: {
      type: 'Point',
      coordinates: [77.2126, 28.5276]
    },
    latitude: 28.5276,
    longitude: 77.2126,
    rating: 4.7,
    reviewCount: 3100,
    userRatingsTotal: 3100,
    phone: '+91 11 2651 5050',
    internationalPhone: '+91 11 2651 5050',
    website: 'https://www.maxhealthcare.in',
    openNow: true,
    businessStatus: 'OPERATIONAL',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Max+Super+Speciality+Hospital+Saket&query_place_id=mock_hosp_008',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=28.5276,77.2126&destination_place_id=mock_hosp_008',
    openingHours: {
      openNow: true,
      weekdayText: [
        'Monday: Open 24 hours',
        'Tuesday: Open 24 hours',
        'Wednesday: Open 24 hours',
        'Thursday: Open 24 hours',
        'Friday: Open 24 hours',
        'Saturday: Open 24 hours',
        'Sunday: Open 24 hours'
      ]
    },
    editorialSummary: 'Leading multi-speciality tertiary healthcare center located in South Delhi.'
  }
];

export class MockLocationProvider implements ILocationProvider {
  public readonly providerName = 'mock' as const;

  public async searchNearby(query: INearbyPlacesQuery): Promise<INearbyPlacesResult> {
    const {
      latitude,
      longitude,
      radiusMeters = 50000,
      type,
      keyword,
      openNow,
      minRating,
      sort = 'distance',
      limit
    } = query;

    // Calculate deterministic geodesic distances to all mock places
    let results: IPlaceResult[] = MOCK_HEALTHCARE_PLACES.map((place) => {
      const distanceMeters = calculateHaversineDistanceMeters(
        latitude,
        longitude,
        place.latitude,
        place.longitude
      );
      const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;

      return {
        ...place,
        distanceMeters,
        distanceKm
      };
    });

    // 1. Filter by facility type if provided
    if (type && type !== 'all') {
      const targetType = type.toLowerCase().trim();
      results = results.filter((p) => {
        if (p.type.toLowerCase() === targetType) return true;
        if (p.types.some((t) => t.toLowerCase() === targetType)) return true;
        if (targetType === 'clinic' && p.types.includes('doctor')) return true;
        return false;
      });
    }

    // 2. Filter by keyword if provided
    if (keyword && keyword.trim()) {
      const q = keyword.toLowerCase().trim();
      const terms = q.split(/\s+/).filter(Boolean);
      results = results.filter((p) => {
        const searchableText = [
          p.name,
          p.address,
          p.vicinity || '',
          p.formattedAddress || '',
          p.editorialSummary || '',
          p.openingHours?.weekdayText?.join(' ') || '',
          ...p.types
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(q) || terms.some((term) => searchableText.includes(term));
      });
    }


    // 3. Filter by openNow if required
    if (openNow === true) {
      results = results.filter((p) => p.openNow === true);
    }

    // 4. Filter by minimumRating if required
    if (typeof minRating === 'number' && !isNaN(minRating)) {
      results = results.filter((p) => p.rating !== null && p.rating >= minRating);
    }

    // 5. Filter strictly by radius in meters (geodesic distance)
    if (radiusMeters > 0) {
      results = results.filter((p) => (p.distanceMeters ?? 0) <= radiusMeters);
    }

    // 6. Sort deterministically
    if (sort === 'distance') {
      results.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    } else if (sort === 'rating') {
      results.sort((a, b) => {
        const ratingA = a.rating ?? -1;
        const ratingB = b.rating ?? -1;
        if (ratingB !== ratingA) {
          return ratingB - ratingA;
        }
        if (b.reviewCount !== a.reviewCount) {
          return b.reviewCount - a.reviewCount;
        }
        return (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0);
      });
    }

    const paginated = typeof limit === 'number' && limit > 0 ? results.slice(0, limit) : results;

    return {
      provider: 'mock',
      places: paginated,
      totalReturned: results.length
    };
  }

  public async getPlaceDetails(placeId: string): Promise<IPlaceResult | null> {
    const place = MOCK_HEALTHCARE_PLACES.find((p) => p.placeId === placeId);
    if (!place) return null;
    return { ...place };
  }

  public async geocode(address: string): Promise<IGeocodeResult | null> {
    const normalized = address.toLowerCase().trim();

    const match = MOCK_HEALTHCARE_PLACES.find(
      (p) =>
        p.address.toLowerCase().includes(normalized) ||
        p.vicinity?.toLowerCase().includes(normalized) ||
        p.formattedAddress?.toLowerCase().includes(normalized)
    );

    if (match) {
      return {
        formattedAddress: match.formattedAddress || match.address,
        location: {
          latitude: match.latitude,
          longitude: match.longitude
        },
        placeId: match.placeId
      };
    }

    // Well-known Indian city center coordinates
    const CITY_COORDINATES: Record<string, { lat: number; lng: number; city: string; state: string }> = {
      delhi: { lat: 28.6139, lng: 77.2090, city: 'New Delhi', state: 'Delhi' },
      'new delhi': { lat: 28.6139, lng: 77.2090, city: 'New Delhi', state: 'Delhi' },
      mumbai: { lat: 19.0760, lng: 72.8777, city: 'Mumbai', state: 'Maharashtra' },
      bengaluru: { lat: 12.9716, lng: 77.5946, city: 'Bengaluru', state: 'Karnataka' },
      bangalore: { lat: 12.9716, lng: 77.5946, city: 'Bengaluru', state: 'Karnataka' },
      chennai: { lat: 13.0827, lng: 80.2707, city: 'Chennai', state: 'Tamil Nadu' },
      kolkata: { lat: 22.5726, lng: 88.3639, city: 'Kolkata', state: 'West Bengal' },
      hyderabad: { lat: 17.3850, lng: 78.4867, city: 'Hyderabad', state: 'Telangana' },
      gurugram: { lat: 28.4595, lng: 77.0266, city: 'Gurugram', state: 'Haryana' },
      gurgaon: { lat: 28.4595, lng: 77.0266, city: 'Gurugram', state: 'Haryana' },
      pune: { lat: 18.5204, lng: 73.8567, city: 'Pune', state: 'Maharashtra' },
      noida: { lat: 28.5355, lng: 77.3910, city: 'Noida', state: 'Uttar Pradesh' }
    };

    for (const [cityName, coord] of Object.entries(CITY_COORDINATES)) {
      if (normalized.includes(cityName)) {
        return {
          formattedAddress: `${coord.city}, ${coord.state}, India`,
          location: {
            latitude: coord.lat,
            longitude: coord.lng
          },
          city: coord.city,
          state: coord.state,
          country: 'India'
        };
      }
    }

    // Default fallback mock coordinates (New Delhi Center)
    return {
      formattedAddress: address,
      location: {
        latitude: 28.6139,
        longitude: 77.2090
      },
      city: 'New Delhi',
      country: 'India'
    };
  }
}
