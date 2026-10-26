import { INormalizedObservation, ILongitudinalTrend, TrendDirection } from '../../types';
import { areUnitsCompatible } from './markerNormalizer';

export function calculateLongitudinalTrends(
  groupedObservations: Map<string, { displayName: string; observations: INormalizedObservation[] }>
): ILongitudinalTrend[] {
  const trends: ILongitudinalTrend[] = [];

  for (const [markerKey, { displayName, observations }] of groupedObservations.entries()) {
    if (!observations || observations.length === 0) continue;

    // Separate observations by unit compatibility if distinct units exist
    const unitBuckets = new Map<string, INormalizedObservation[]>();
    for (const obs of observations) {
      const u = obs.unit || 'unknown_unit';
      let matchedBucketKey = '';
      for (const bucketUnit of unitBuckets.keys()) {
        if (areUnitsCompatible(u, bucketUnit)) {
          matchedBucketKey = bucketUnit;
          break;
        }
      }
      if (!matchedBucketKey) {
        matchedBucketKey = u;
        unitBuckets.set(matchedBucketKey, []);
      }
      unitBuckets.get(matchedBucketKey)!.push(obs);
    }

    // Process each unit bucket
    for (const bucketObs of unitBuckets.values()) {
      // Sort chronologically ascending (earliest first)
      const sorted = [...bucketObs].sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime());

      // Filter numeric observations
      const numericObs = sorted.filter((o) => o.numericValue !== null);

      if (numericObs.length === 0) continue;

      const firstObs = numericObs[0];
      const latestObs = numericObs[numericObs.length - 1];

      if (!firstObs || !latestObs) continue;

      let direction = TrendDirection.INSUFFICIENT_DATA;
      let changeValue: number | null = null;
      let changePercent: number | null = null;

      if (numericObs.length >= 2 && firstObs.numericValue !== null && latestObs.numericValue !== null) {
        const firstVal = firstObs.numericValue;
        const latestVal = latestObs.numericValue;
        const delta = latestVal - firstVal;
        const tolerance = Math.max(0.01, Math.abs(firstVal) * 0.02); // 2% tolerance threshold

        if (delta > tolerance) {
          direction = TrendDirection.INCREASING;
        } else if (delta < -tolerance) {
          direction = TrendDirection.DECREASING;
        } else {
          direction = TrendDirection.STABLE;
        }

        changeValue = Number(delta.toFixed(2));
        if (firstVal !== 0) {
          changePercent = Number(((delta / Math.abs(firstVal)) * 100).toFixed(1));
        }
      }

      trends.push({
        markerKey,
        displayName,
        unit: firstObs.unit || '',
        direction,
        changeValue,
        changePercent,
        observations: sorted,
        baselineValue: firstObs.numericValue,
        latestValue: latestObs.numericValue,
        firstObservedDate: new Date(firstObs.reportDate),
        latestObservedDate: new Date(latestObs.reportDate)
      });
    }
  }

  // Sort trends: multi-observation trends first, then alphabetically by displayName
  return trends.sort((a, b) => {
    if (a.observations.length >= 2 && b.observations.length < 2) return -1;
    if (a.observations.length < 2 && b.observations.length >= 2) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
}
