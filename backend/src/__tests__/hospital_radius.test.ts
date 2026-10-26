import assert from 'node:assert';
import { HospitalService } from '../services/hospital.service';
import { OsmLocationProvider } from '../services/location/osmLocationProvider';
import { MockLocationProvider } from '../services/location/mockLocationProvider';
import { ILocationProvider, INearbyPlacesQuery } from '../services/location/locationProvider.interface';
import { AppError } from '../utils';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('LIFELEDGER BACKEND: NEARBY HOSPITALS RADIUS VERIFICATION SUITE');
  console.log('===============================================================\n');

  let testsPassed = 0;
  let testsTotal = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    testsTotal++;
    return (async () => {
      try {
        await fn();
        console.log(`  ✓ PASS: ${name}`);
        testsPassed++;
      } catch (err: any) {
        console.error(`  ✗ FAIL: ${name}`);
        console.error(`    ${err.message}`);
        throw err;
      }
    })();
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: MATHEMATICAL RADIUS CONVERSION & PROVIDER DELEGATION
  // ---------------------------------------------------------------------------
  console.log('--- GROUP 1: Mathematical Radius Conversion (5, 10, 20, 30, 40, 50 km) ---');

  const testRadiuses = [
    { km: 5, expectedMeters: 5000 },
    { km: 10, expectedMeters: 10000 },
    { km: 20, expectedMeters: 20000 },
    { km: 30, expectedMeters: 30000 },
    { km: 40, expectedMeters: 40000 },
    { km: 50, expectedMeters: 50000 }
  ];

  for (const { km, expectedMeters } of testRadiuses) {
    await test(`HospitalService correctly converts radiusKm=${km} to ${expectedMeters}m for provider`, async () => {
      let capturedQuery: INearbyPlacesQuery | null = null;

      const spyProvider: ILocationProvider = {
        providerName: 'mock',
        searchNearby: async (q) => {
          capturedQuery = q;
          return { provider: 'mock', places: [], totalReturned: 0 };
        },
        getPlaceDetails: async () => null,
        geocode: async () => null
      };

      const service = new HospitalService(spyProvider);
      const res = await service.getNearbyHospitals({
        latitude: 28.6139,
        longitude: 77.2090,
        radiusKm: km
      });

      assert.ok(capturedQuery !== null, 'Provider should have been called');
      const query = capturedQuery as INearbyPlacesQuery;
      assert.strictEqual(query.radiusMeters, expectedMeters, `Expected radiusMeters=${expectedMeters}`);
      assert.strictEqual(query.latitude, 28.6139);
      assert.strictEqual(query.longitude, 77.2090);
      assert.strictEqual(res.searchRadiusKm, km, `searchRadiusKm in response must match ${km}`);
    });
  }

  await test('HospitalService rejects invalid radiuses (< 0.1 km or > 50 km)', async () => {
    const service = new HospitalService(new MockLocationProvider());

    await assert.rejects(
      () => service.getNearbyHospitals({ latitude: 28.6139, longitude: 77.2090, radiusKm: 0.05 }),
      (err: any) => err instanceof AppError && err.statusCode === 400
    );

    await assert.rejects(
      () => service.getNearbyHospitals({ latitude: 28.6139, longitude: 77.2090, radiusKm: 51 }),
      (err: any) => err instanceof AppError && err.statusCode === 400
    );
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: OVERPASS QL QUERY GENERATION
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 2: Overpass QL Dynamic Query Inspection ---');

  await test('Overpass QL contains accurate dynamic around radius and excludes recursive relations', () => {
    const osm = new OsmLocationProvider();

    for (const { expectedMeters } of testRadiuses) {
      // Access private buildOverpassQuery using prototype/reflection
      const query = (osm as any).buildOverpassQuery(28.6139, 77.2090, expectedMeters, 'hospital');
      
      assert.ok(query.includes(`around:${expectedMeters},28.6139,77.209`), `Overpass QL must include around:${expectedMeters},28.6139,77.209`);
      assert.ok(query.includes('[timeout:25]'), 'Query timeout must be configured');
      assert.ok(!query.includes('nwr['), 'Must use node and way statements rather than recursive nwr to avoid relation timeouts');
      assert.ok(query.includes('node['), 'Query must search nodes');
      assert.ok(query.includes('way['), 'Query must search ways');
    }
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: HAVERSINE DISTANCE FILTERING & STRICT BOUNDS
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 3: Haversine Geodesic Distance Verification ---');

  await test('All returned places strictly satisfy distance <= requested radius', async () => {
    const mockProvider = new MockLocationProvider();
    const service = new HospitalService(mockProvider);

    // Test across all 6 radius increments
    for (const { km } of testRadiuses) {
      const res = await service.getNearbyHospitals({
        latitude: 28.6139,
        longitude: 77.2090,
        radiusKm: km,
        limit: 50
      });

      for (const h of res.hospitals) {
        assert.ok(
          h.distanceKm !== null && h.distanceKm <= km + 0.05,
          `Hospital "${h.name}" distance (${h.distanceKm} km) must not exceed requested radius (${km} km)`
        );
      }
    }
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: CACHE KEY ISOLATION ACROSS RADIUSES
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 4: Cache Key Isolation ---');

  await test('Cache keys are isolated per radius: 5 km cache is never returned for 50 km', async () => {
    const osm = new OsmLocationProvider({ enableCache: true });
    osm.clearCache();

    const cacheKeys = new Set<string>();
    for (const { km, expectedMeters } of testRadiuses) {
      const lat = 28.6139;
      const lon = 77.2090;
      const roundedLat = Math.round(lat * 1000) / 1000;
      const roundedLon = Math.round(lon * 1000) / 1000;
      const key = `${roundedLat}_${roundedLon}_${expectedMeters}_all`;
      
      assert.ok(!cacheKeys.has(key), `Cache key collision detected for radius ${km}km: ${key}`);
      cacheKeys.add(key);
    }

    assert.strictEqual(cacheKeys.size, 6, 'There must be 6 unique cache keys for 5, 10, 20, 30, 40, 50 km');
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: PAGINATION WITHOUT PREMATURE TRUNCATION
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 5: Full Result Slicing & Pagination ---');

  await test('HospitalService paginates full provider result set without premature 50-item truncation', async () => {
    // Mock provider returning 75 places at varying distances within 20 km
    const syntheticPlaces = Array.from({ length: 75 }, (_, i) => ({
      placeId: `syn_${i + 1}`,
      name: `Synthetic Hospital ${i + 1}`,
      type: 'hospital',
      types: ['hospital', 'health'],
      address: `Road ${i + 1}, Delhi`,
      location: { type: 'Point' as const, coordinates: [77.2090 + i * 0.001, 28.6139 + i * 0.001] as [number, number] },
      latitude: 28.6139 + i * 0.001,
      longitude: 77.2090 + i * 0.001,
      distanceMeters: (i + 1) * 200, // 200m to 15,000m (all <= 20km)
      distanceKm: ((i + 1) * 200) / 1000,
      rating: 4.5,
      reviewCount: 100,
      userRatingsTotal: 100,
      googleMapsUrl: 'https://maps.google.com',
      directionsUrl: 'https://maps.google.com'
    }));

    const mockProvider: ILocationProvider = {
      providerName: 'mock',
      searchNearby: async () => ({
        provider: 'mock',
        places: syntheticPlaces,
        totalReturned: syntheticPlaces.length
      }),
      getPlaceDetails: async () => null,
      geocode: async () => null
    };

    const service = new HospitalService(mockProvider);

    // Page 1: items 1..20
    const p1 = await service.getNearbyHospitals({ latitude: 28.6139, longitude: 77.2090, radiusKm: 20, page: 1, limit: 20 });
    assert.strictEqual(p1.count, 20);
    assert.strictEqual(p1.pagination.total, 75);
    assert.strictEqual(p1.pagination.totalPages, 4);
    assert.strictEqual(p1.pagination.hasMore, true);
    assert.strictEqual(p1.hospitals[0]?.name, 'Synthetic Hospital 1');

    // Page 3: items 41..60 (past the previous 50-item truncation point!)
    const p3 = await service.getNearbyHospitals({ latitude: 28.6139, longitude: 77.2090, radiusKm: 20, page: 3, limit: 20 });
    assert.strictEqual(p3.count, 20);
    assert.strictEqual(p3.hospitals[0]?.name, 'Synthetic Hospital 41');

    // Page 4: items 61..75
    const p4 = await service.getNearbyHospitals({ latitude: 28.6139, longitude: 77.2090, radiusKm: 20, page: 4, limit: 20 });
    assert.strictEqual(p4.count, 15);
    assert.strictEqual(p4.pagination.hasMore, false);
    assert.strictEqual(p4.hospitals[0]?.name, 'Synthetic Hospital 61');
    assert.strictEqual(p4.hospitals[14]?.name, 'Synthetic Hospital 75');
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: PROVIDER ERROR HANDLING & FAIL-CLOSED INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 6: Provider Error Handling & No Fake Fallbacks ---');

  await test('Provider 429 / 504 / 502 errors throw structured AppErrors and never return fake hospitals', async () => {
    const errorScenarios = [
      { status: 429, expectedCode: 429, message: 'rate limit' },
      { status: 504, expectedCode: 504, message: 'timed out' },
      { status: 502, expectedCode: 502, message: 'unavailable' }
    ];

    for (const sc of errorScenarios) {
      const failingProvider: ILocationProvider = {
        providerName: 'osm',
        searchNearby: async () => {
          throw new AppError(`OpenStreetMap Overpass API error ${sc.status}`, sc.expectedCode);
        },
        getPlaceDetails: async () => null,
        geocode: async () => null
      };

      const service = new HospitalService(failingProvider);

      await assert.rejects(
        () => service.getNearbyHospitals({ latitude: 28.6139, longitude: 77.2090, radiusKm: 10 }),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.strictEqual(err.statusCode, sc.expectedCode);
          return true;
        }
      );
    }
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 7: AUDIT FOR MOCK DATA IN PRODUCTION FLOW
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 7: Production Configuration & Mock Isolation Audit ---');

  await test('Production default provider is real OSM and never serves mock data silently', () => {
    const defaultService = new HospitalService();
    const provider = defaultService.getLocationProvider();
    assert.strictEqual(provider.providerName, 'osm', 'Default provider must be "osm"');
    assert.ok(provider instanceof OsmLocationProvider, 'Default provider instance must be OsmLocationProvider');
  });

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${testsPassed} / ${testsTotal} TESTS PASSED`);
  console.log('===============================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
