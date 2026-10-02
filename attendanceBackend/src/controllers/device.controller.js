import { serializeDevice } from '../presenters/session.presenter.js';
import { getDeviceStatusSnapshot } from '../services/device.service.js';

export async function deviceStatus(req, res, next) {
  try {
    const snapshot = await getDeviceStatusSnapshot(req.device.id);

    return res.status(200).json({
      success: true,
      message: 'Device API is healthy.',
      device: serializeDevice(req.device),
      session: snapshot.session,
      stats: snapshot.stats,
    });
  } catch (error) {
    return next(error);
  }
}
