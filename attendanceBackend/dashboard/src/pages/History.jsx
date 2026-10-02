import { useDeferredValue, useMemo, useState } from 'react';
import { Download, FileText, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { downloadSessionCsv } from '../services/api.js';
import { useAttendance } from '../hooks/useAttendance.js';
import { formatDateTime, formatDurationMinutes, getSessionStatus, getSessionTitle } from '../utils/format.js';

const EMPTY_SESSIONS = [];

export default function History({ auth, onLogout }) {
  const [searchValue, setSearchValue] = useState('');
  const deferredSearchValue = useDeferredValue(searchValue);
  const navigate = useNavigate();
  const {
    session,
    historyQuery,
    deviceStatusQuery,
    socketConnected,
  } = useAttendance({ token: auth.token });
  const device = deviceStatusQuery.data?.device ?? session?.device ?? null;

  const sessions = historyQuery.data ?? EMPTY_SESSIONS;
  const filteredSessions = useMemo(() => {
    const searchTerm = deferredSearchValue.trim().toLowerCase();
    if (!searchTerm) {
      return sessions;
    }

    return sessions.filter((item) => (
      item.courseCode?.toLowerCase().includes(searchTerm)
      || item.lecturerId?.toLowerCase().includes(searchTerm)
      || item.device?.deviceId?.toLowerCase().includes(searchTerm)
      || item.device?.name?.toLowerCase().includes(searchTerm)
      || item.status?.toLowerCase().includes(searchTerm)
    ));
  }, [deferredSearchValue, sessions]);

  async function handleDownloadCsv(historySession) {
    try {
      const csvBlob = await downloadSessionCsv(historySession.id, auth.token);
      const objectUrl = window.URL.createObjectURL(csvBlob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${(historySession.courseCode || 'attendance-session').replace(/[^a-z0-9-_]+/gi, '-')}-${historySession.id}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Unable to download CSV.');
    }
  }

  return (
    <main className="app-shell">
      <Header
        auth={auth}
        session={session}
        device={device}
        socketConnected={socketConnected}
        onLogout={onLogout}
      />

      <section className="page-section">
        <div className="page-section__heading">
          <div>
            <span className="eyebrow">Attendance history</span>
            <h2>Recent sessions</h2>
            <p>
              Review the latest attendance windows, their device source, and how each session closed.
            </p>
          </div>

          <button
            type="button"
            className="button button--ghost"
            onClick={() => historyQuery.refetch()}
            disabled={historyQuery.isFetching}
          >
            <RefreshCw size={16} />
            <span>{historyQuery.isFetching ? 'Refreshing...' : 'Refresh history'}</span>
          </button>
        </div>

        <div className="toolbar">
          <label className="search-field">
            <Search size={16} />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search course, lecturer, device, or status"
            />
          </label>
          <p>
            Showing
            {' '}
            <strong>{filteredSessions.length}</strong>
            {' '}
            of
            {' '}
            <strong>{sessions.length}</strong>
            {' '}
            sessions.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Lecturer</th>
                <th>Device</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length > 0 ? (
                filteredSessions.map((historySession) => (
                  <tr
                    key={historySession.id}
                    className={historySession.id === session?.id ? 'data-table__row--active' : ''}
                  >
                    <td>{getSessionTitle(historySession)}</td>
                    <td>{historySession.lecturerId || 'Lecturer pending'}</td>
                    <td>{historySession.device?.name || historySession.device?.deviceId || 'Device pending'}</td>
                    <td>{formatDateTime(historySession.startedAt)}</td>
                    <td>{formatDateTime(historySession.endedAt ?? historySession.expiresAt)}</td>
                    <td>{formatDurationMinutes(historySession)}</td>
                    <td>
                      <StatusBadge status={getSessionStatus(historySession)} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="button button--ghost button--table"
                          onClick={() => navigate(`/history/${historySession.id}/report`)}
                        >
                          <FileText size={16} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          className="button button--ghost button--table"
                          onClick={() => handleDownloadCsv(historySession)}
                        >
                          <Download size={16} />
                          <span>CSV</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="data-table__empty">
                    {historyQuery.isLoading
                      ? 'Loading session history...'
                      : 'No session history matches your current search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
