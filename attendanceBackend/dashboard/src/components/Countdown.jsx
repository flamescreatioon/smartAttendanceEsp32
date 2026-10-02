import { useEffect, useState } from 'react';
import { formatCountdown, getRemainingSeconds, getSessionStatus } from '../utils/format.js';

export default function Countdown({ session }) {
  const [secondsLeft, setSecondsLeft] = useState(() => getRemainingSeconds(session));

  useEffect(() => {
    setSecondsLeft(getRemainingSeconds(session));

    if (!session) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setSecondsLeft(getRemainingSeconds(session));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [session]);

  const sessionStatus = getSessionStatus(session);
  const isActive = sessionStatus === 'ACTIVE';

  return (
    <div className="countdown">
      <span className="eyebrow">{isActive ? 'Expires in' : 'Session status'}</span>
      <strong className="countdown__value">
        {isActive ? formatCountdown(secondsLeft) : session ? '00:00' : '--:--'}
      </strong>
      <span className="countdown__hint">
        {isActive && 'Real-time countdown for the live attendance window.'}
        {sessionStatus === 'EXPIRED' && 'This session has reached its expiry time.'}
        {sessionStatus === 'ENDED' && 'The session has been closed from the backend.'}
        {sessionStatus === 'IDLE' && 'A new QR code will appear as soon as a session starts.'}
      </span>
    </div>
  );
}
