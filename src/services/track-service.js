export class TrackService {
  constructor({ dhlFetchShipment } = {}) {
    if (!dhlFetchShipment) {
      throw new Error('dhlFetchShipment is required');
    }

    this.dhlFetchShipment = dhlFetchShipment;
  }

  async trackDhl(trackingNumber) {
    if (!trackingNumber) {
      throw new Error('trackingNumber is required');
    }

    return this.dhlFetchShipment(trackingNumber);
  }
}
