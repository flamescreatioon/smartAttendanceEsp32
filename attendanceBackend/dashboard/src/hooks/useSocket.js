import { useEffect, useEffectEvent, useState } from 'react';
import { createSocketClient } from '../services/socket.js';

export function useSocket({
  token,
  onSessionStarted,
  onSessionEnded,
  onAttendanceUpdated,
  onStudentVerified,
} = {}) {
  const [isConnected, setIsConnected] = useState(false);

  const handleSocketReady = useEffectEvent(() => {
    setIsConnected(true);
  });

  const handleConnected = useEffectEvent(() => {
    setIsConnected(true);
  });

  const handleDisconnected = useEffectEvent(() => {
    setIsConnected(false);
  });

  const handleSessionStarted = useEffectEvent((payload) => {
    onSessionStarted?.(payload);
  });

  const handleSessionEnded = useEffectEvent((payload) => {
    onSessionEnded?.(payload);
  });

  const handleAttendanceUpdated = useEffectEvent((payload) => {
    onAttendanceUpdated?.(payload);
  });

  const handleStudentVerified = useEffectEvent((payload) => {
    onStudentVerified?.(payload);
  });

  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      return undefined;
    }

    const socket = createSocketClient(token);

    socket.on('connect', handleConnected);
    socket.on('disconnect', handleDisconnected);
    socket.on('connect_error', handleDisconnected);
    socket.on('socket:ready', handleSocketReady);
    socket.on('session:started', handleSessionStarted);
    socket.on('session:ended', handleSessionEnded);
    socket.on('attendance-updated', handleAttendanceUpdated);
    socket.on('student-verified', handleStudentVerified);

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return {
    isConnected,
  };
}
