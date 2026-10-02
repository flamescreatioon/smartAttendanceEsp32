import { Copy, ExternalLink, Maximize2, QrCode, X } from 'lucide-react';
import { useState } from 'react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import Countdown from './Countdown.jsx';
import StatusBadge from './StatusBadge.jsx';
import { getLecturerName, getQrValue, getSessionStatus, getSessionTitle } from '../utils/format.js';

export default function QRCard({ session }) {
  const [isProjectionOpen, setIsProjectionOpen] = useState(false);
  const qrValue = getQrValue(session);

  async function copyAttendanceUrl() {
    if (!qrValue) {
      return;
    }

    await navigator.clipboard.writeText(qrValue);
    toast.success('Student link copied.');
  }

  return (
    <section className="panel qr-card">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">QR display</span>
          <h2>Student check-in code</h2>
        </div>
        <StatusBadge status={getSessionStatus(session)} />
      </div>

      <div className="qr-card__surface">
        {qrValue ? (
          <div className="qr-card__canvas">
            <QRCode
              value={qrValue}
              size={260}
              fgColor="#0f172a"
              bgColor="transparent"
            />
          </div>
        ) : (
          <div className="qr-card__placeholder" aria-hidden="true">
            <QrCode size={64} />
          </div>
        )}
      </div>

      <div className="qr-card__copy">
        <h3>{session ? 'Attendance session active' : 'Waiting for active session'}</h3>
        <p>
          {session
            ? 'Students scan this code, fill in their details, request an OTP, and verify attendance on their phone.'
            : 'The QR code will appear here automatically when the backend receives a new session event.'}
        </p>
      </div>

      {qrValue ? (
        <>
          <div className="qr-card__url" title={qrValue}>
            {qrValue}
          </div>

          <div className="qr-card__actions">
            <button type="button" className="button button--ghost" onClick={copyAttendanceUrl}>
              <Copy size={16} />
              <span>Copy link</span>
            </button>
            <a className="button button--ghost" href={qrValue} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              <span>Open student page</span>
            </a>
            <button type="button" className="button button--primary" onClick={() => setIsProjectionOpen(true)}>
              <Maximize2 size={16} />
              <span>Project QR</span>
            </button>
          </div>
        </>
      ) : null}

      <Countdown session={session} />

      {isProjectionOpen ? (
        <div className="qr-projection" role="dialog" aria-modal="true" aria-label="Projected QR code">
          <button
            type="button"
            className="qr-projection__close"
            onClick={() => setIsProjectionOpen(false)}
            aria-label="Close projected QR code"
          >
            <X size={22} />
          </button>

          <div className="qr-projection__content">
            <div className="qr-projection__heading">
              <span>{getSessionTitle(session)}</span>
              <strong>{getLecturerName(session)}</strong>
            </div>

            <div className="qr-projection__canvas">
              <QRCode
                value={qrValue}
                size={420}
                fgColor="#0f172a"
                bgColor="transparent"
              />
            </div>

            <div className="qr-projection__footer">
              <span>Scan to check in</span>
              <small>{qrValue}</small>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
