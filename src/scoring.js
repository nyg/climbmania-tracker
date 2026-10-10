const POINTS_PER_BLOCK = 1000;

// Absorbs float error on sums that are exactly an integer.
const FLOAT_TOLERANCE = 1e-6;

function increment(counts, block) {
  counts.set(block, (counts.get(block) ?? 0) + 1);
}

export function countValidations(event) {
  const tops = new Map();
  const zones = new Map();
  let scoresZones = false;
  for (const category of event.categories ?? []) {
    for (const athlete of category.athletes ?? []) {
      for (const block of athlete.tops) {
        increment(tops, block);
        increment(zones, block);
      }
      for (const block of athlete.zones) {
        increment(zones, block);
        scoresZones = true;
      }
    }
  }
  return { tops, zones: scoresZones ? zones : null };
}

function valueOf(count) {
  return count > 0 ? POINTS_PER_BLOCK / count : null;
}

export function blockValues(counts, block) {
  const topCount = counts.tops.get(block) ?? 0;
  const zoneCount = counts.zones?.get(block) ?? 0;
  return { top: valueOf(topCount), zone: valueOf(zoneCount), topCount, zoneCount };
}

export function earnedPoints(values, isTop, isZone) {
  return (isTop ? values.top ?? 0 : 0) + (isTop || isZone ? values.zone ?? 0 : 0);
}

export function isApproximate({ tops, zones, points, blockCounts }) {
  const earnedOnTops = tops.map(block => earnedPoints(blockValues(blockCounts, block), true, false));
  const earnedOnZones = zones.map(block => earnedPoints(blockValues(blockCounts, block), false, true));
  const total = [...earnedOnTops, ...earnedOnZones].reduce((sum, earned) => sum + earned, 0);
  return Math.floor(total + FLOAT_TOLERANCE) !== points;
}
