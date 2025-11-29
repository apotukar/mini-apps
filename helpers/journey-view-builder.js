export function buildJourneyView(legs, index, transportLabels) {
  if (!legs.length) {
    return null;
  }

  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];

  const dep = new Date(firstLeg.departure);
  const arr = new Date(lastLeg.arrival);

  const durationMinutes = ((arr - dep) / 60000).toFixed(0);
  const transfers = Math.max(0, legs.length - 1);

  const legsView = legs.map((leg, idx) => {
    const dep = leg.departure ? new Date(leg.departure) : null;
    const depPlanned = leg.plannedDeparture ? new Date(leg.plannedDeparture) : null;
    const arr = leg.arrival ? new Date(leg.arrival) : null;
    const arrPlanned = leg.plannedArrival ? new Date(leg.plannedArrival) : null;

    const depDelayMin =
      dep && depPlanned ? Math.round((dep.getTime() - depPlanned.getTime()) / 60000) : 0;
    const arrDelayMin =
      arr && arrPlanned ? Math.round((arr.getTime() - arrPlanned.getTime()) / 60000) : 0;

    const line = leg.line || {};
    const productKey = line.product || line.mode || '';
    const product = transportLabels[productKey] || productKey;
    const lineName = line.name || line.label || line.id || '';
    const lineText = [product, lineName].filter(Boolean).join(' ');

    const statusRemarks = (leg.remarks || [])
      .filter(r => r.type === 'status')
      .map(r => r.summary || r.text);

    const hintRemarks = (leg.remarks || [])
      .filter(r => r.type === 'hint')
      .map(r => r.summary || r.text);

    const isWalking = !!leg.walking;
    const isDelayed = depDelayMin > 0 || arrDelayMin > 0;

    return {
      idx: idx + 1,
      originName: leg.origin?.name || '',
      destName: leg.destination?.name || '',
      direction: leg.direction || '',
      product,
      lineName,
      lineText,
      isWalking,
      distance: leg.distance || null,
      isPublic: leg.public !== false,
      loadFactor: leg.loadFactor || null,

      depTime: dep,
      depPlannedTime: depPlanned,
      depDelayMin,
      depPlatform: leg.departurePlatform || null,
      depPlatformPlanned: leg.plannedDeparturePlatform || null,

      arrTime: arr,
      arrPlannedTime: arrPlanned,
      arrDelayMin,
      arrPlatform: leg.arrivalPlatform || null,
      arrPlatformPlanned: leg.plannedArrivalPlatform || null,

      isDelayed,
      statusRemarks,
      hintRemarks
    };
  });

  return {
    number: index + 1,
    departure: dep,
    arrival: arr,
    duration: durationMinutes,
    transfers,
    legs: legsView
  };
}
