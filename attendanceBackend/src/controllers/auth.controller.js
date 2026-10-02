import { serializeDevice, serializeSession } from '../presenters/session.presenter.js';
import { loginUser, resolveUserDevice } from '../services/auth.service.js';
import { getDeviceStatusSnapshot } from '../services/device.service.js';
import { getCurrentActiveSession } from '../services/session.service.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    const result = await loginUser({ email, password });
    const device = await resolveUserDevice(result.user);
    const snapshot = device
      ? await getDeviceStatusSnapshot(device.id)
      : null;

    return res.status(200).json({
      success: true,
      data: {
        token: result.token,
        user: result.user,
        device: device ? serializeDevice(device) : null,
        session: device ? serializeSession(await getCurrentActiveSession(device.id)) : null,
        stats: snapshot?.stats ?? null,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function currentUser(req, res, next) {
  try {
    const snapshot = req.userDevice
      ? await getDeviceStatusSnapshot(req.userDevice.id)
      : null;

    return res.status(200).json({
      success: true,
      data: {
        user: req.user,
        device: req.userDevice ? serializeDevice(req.userDevice) : null,
        session: req.userDevice ? serializeSession(await getCurrentActiveSession(req.userDevice.id)) : null,
        stats: snapshot?.stats ?? null,
      },
    });
  } catch (error) {
    return next(error);
  }
}
