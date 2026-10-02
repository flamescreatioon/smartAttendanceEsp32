import { useEffect, useEffectEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  endSession,
  getDashboardContext,
  getCurrentSession,
  getSessionHistory,
  startSession,
} from '../services/api.js';
import { computeAttendanceStats } from '../utils/format.js';
import { useSocket } from './useSocket.js';

function mergeSession(currentSession, incomingSession) {
  if (!incomingSession) {
    return null;
  }

  return {
    ...currentSession,
    ...incomingSession,
    attendanceUrl: incomingSession.attendanceUrl ?? currentSession?.attendanceUrl ?? null,
    device: incomingSession.device ?? currentSession?.device ?? null,
  };
}

function normalizeAttendanceRecord(record) {
  const identifier = String(
    record.id
    ?? record.studentId
    ?? record.matricNumber
    ?? record.matricNo
    ?? record.name
    ?? `${Date.now()}`,
  );
  const checkInTime = record.checkInTime
    ?? record.checkedInAt
    ?? record.time
    ?? record.createdAt
    ?? new Date().toISOString();

  return {
    id: identifier,
    name: record.name ?? record.fullName ?? 'Unknown student',
    matricNumber: record.matricNumber ?? record.matricNo ?? 'Pending',
    department: record.department ?? record.programme ?? 'Unknown department',
    checkInTime,
    otpStatus: record.otpStatus ?? (record.verified ? 'Verified' : 'Pending'),
    attendanceStatus: record.attendanceStatus ?? record.status ?? 'Verified',
  };
}

function upsertAttendanceRecord(currentRecords, incomingRecord) {
  const normalizedRecord = normalizeAttendanceRecord(incomingRecord);
  const nextRecords = [...currentRecords];
  const recordIndex = nextRecords.findIndex((record) => (
    record.id === normalizedRecord.id
    || record.matricNumber === normalizedRecord.matricNumber
  ));

  if (recordIndex === -1) {
    nextRecords.unshift(normalizedRecord);
  } else {
    nextRecords[recordIndex] = {
      ...nextRecords[recordIndex],
      ...normalizedRecord,
    };
  }

  return nextRecords.sort((leftRecord, rightRecord) => (
    new Date(rightRecord.checkInTime).getTime() - new Date(leftRecord.checkInTime).getTime()
  ));
}

export function useAttendance({ token }) {
  const queryClient = useQueryClient();
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const currentSessionQueryKey = ['current-session', token];
  const historyQueryKey = ['session-history', token];
  const deviceQueryKey = ['dashboard-context', token];

  const currentSessionQuery = useQuery({
    queryKey: currentSessionQueryKey,
    queryFn: () => getCurrentSession(token),
    enabled: Boolean(token),
    refetchInterval: 60000,
    staleTime: 15000,
  });

  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    queryFn: () => getSessionHistory(18, token),
    enabled: Boolean(token),
    staleTime: 30000,
  });

  const deviceStatusQuery = useQuery({
    queryKey: deviceQueryKey,
    queryFn: () => getDashboardContext(token),
    enabled: Boolean(token),
    staleTime: 30000,
  });

  const hydrateSession = useEffectEvent((payload) => {
    queryClient.setQueryData(currentSessionQueryKey, (currentSession) => mergeSession(currentSession, payload));
    queryClient.invalidateQueries({ queryKey: historyQueryKey });
    queryClient.invalidateQueries({ queryKey: deviceQueryKey });
  });

  const closeSession = useEffectEvent(() => {
    queryClient.setQueryData(currentSessionQueryKey, null);
    queryClient.invalidateQueries({ queryKey: historyQueryKey });
    queryClient.invalidateQueries({ queryKey: deviceQueryKey });
  });

  const recordAttendance = useEffectEvent((payload) => {
    if (payload?.sessionId && currentSessionQuery.data?.id && payload.sessionId !== currentSessionQuery.data.id) {
      return;
    }

    setAttendanceRecords((currentRecords) => upsertAttendanceRecord(currentRecords, payload));
  });

  const { isConnected: socketConnected } = useSocket({
    token,
    onSessionStarted: hydrateSession,
    onSessionEnded: closeSession,
    onAttendanceUpdated: recordAttendance,
    onStudentVerified: recordAttendance,
  });

  useEffect(() => {
    if (!currentSessionQuery.data?.id) {
      setAttendanceRecords([]);
      return;
    }

    setAttendanceRecords(currentSessionQuery.data.attendanceRecords ?? []);
  }, [currentSessionQuery.data]);

  const startSessionMutation = useMutation({
    mutationFn: (payload) => startSession(payload, token),
    onSuccess: (response) => {
      if (response.data) {
        queryClient.setQueryData(currentSessionQueryKey, response.data);
      }

      queryClient.invalidateQueries({ queryKey: currentSessionQueryKey });
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
      queryClient.invalidateQueries({ queryKey: deviceQueryKey });
      toast.success('Session started.');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? 'Unable to start a session.');
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: (sessionId) => endSession(sessionId, token),
    onSuccess: () => {
      queryClient.setQueryData(currentSessionQueryKey, null);
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
      queryClient.invalidateQueries({ queryKey: deviceQueryKey });
      toast.success('Session ended.');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? 'Unable to end the session.');
    },
  });

  return {
    session: currentSessionQuery.data ?? null,
    attendanceRecords,
    attendanceStats: computeAttendanceStats(attendanceRecords, currentSessionQuery.data),
    currentSessionQuery,
    historyQuery,
    deviceStatusQuery,
    socketConnected,
    startSession: startSessionMutation.mutateAsync,
    startSessionPending: startSessionMutation.isPending,
    endSession: endSessionMutation.mutateAsync,
    endSessionPending: endSessionMutation.isPending,
  };
}
