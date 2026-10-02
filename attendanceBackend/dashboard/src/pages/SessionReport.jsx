import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { downloadSessionCsv, getSessionReport } from '../services/api.js';
import {
  formatDateTime,
  formatDurationMinutes,
  formatTime,
  getQrValue,
  getSessionStatus,
  getSessionTitle,
} from '../utils/format.js';

function buildCsvFilename(session) {
  const base = (session?.courseCode || session?.id || 'attendance-session')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return `${base || 'attendance-session'}-${session?.id || 'report'}.csv`;
}

export default function SessionReport({ auth, onLogout }) {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();

  const reportQuery = useQuery({
    queryKey: ['session-report', sessionId, auth.token],
    queryFn: () => getSessionReport(sessionId, auth.token),
    enabled: Boolean(sessionId && auth.token),
    staleTime: 30000,
  });

  const session = reportQuery.data;
  const attendanceUrl = getQrValue(session);
  const attendanceRecords = session?.attendanceRecords ?? [];
  const absentStudents = session?.absentStudents ?? [];
  const analytics = session?.attendanceAnalytics ?? null;

  useEffect(() => {
    if (reportQuery.isError) {
      toast.error(reportQuery.error?.response?.data?.message ?? 'Unable to load this report.');
      navigate('/history', { replace: true });
    }
  }, [navigate, reportQuery.error, reportQuery.isError]);

  async function handleDownloadCsv() {
    try {
      const csvBlob = await downloadSessionCsv(sessionId, auth.token);
      const objectUrl = window.URL.createObjectURL(csvBlob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = buildCsvFilename(session);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Unable to download CSV.');
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <main className="app-shell report-shell">
      <Header
        auth={auth}
        session={session}
        socketConnected={false}
        onLogout={onLogout}
      />

      <section className="page-section">
        <div className="page-section__heading">
          <div>
            <span className="eyebrow">Session report</span>
            <h2>{getSessionTitle(session)}</h2>
            <p>
              Printable attendance summary for this session, including verified and pending students.
            </p>
          </div>

          <div className="report-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => reportQuery.refetch()}
              disabled={reportQuery.isFetching}
            >
              <RefreshCw size={16} />
              <span>{reportQuery.isFetching ? 'Refreshing...' : 'Refresh report'}</span>
            </button>
            <button type="button" className="button button--ghost" onClick={handleDownloadCsv} disabled={!session}>
              <Download size={16} />
              <span>Download CSV</span>
            </button>
            <button type="button" className="button button--primary" onClick={handlePrint} disabled={!session}>
              <Printer size={16} />
              <span>Print report</span>
            </button>
          </div>
        </div>
      </section>

      {reportQuery.isLoading ? (
        <section className="panel">
          <p>Loading report...</p>
        </section>
      ) : null}

      {session ? (
        <>
          <section className="stats-grid report-summary">
            <article className="stat-card">
              <div className="stat-card__content">
                <span className="stat-card__label">Enrolled</span>
                <strong className="stat-card__value">{analytics?.enrolledCount ?? 0}</strong>
                <span className="stat-card__helper">Students in the saved class roster</span>
              </div>
            </article>
            <article className="stat-card stat-card--warning">
              <div className="stat-card__content">
                <span className="stat-card__label">Absent</span>
                <strong className="stat-card__value">{analytics?.absentCount ?? 0}</strong>
                <span className="stat-card__helper">Enrolled students not yet verified</span>
              </div>
            </article>
            <article className="stat-card stat-card--success">
              <div className="stat-card__content">
                <span className="stat-card__label">Attendance %</span>
                <strong className="stat-card__value">{analytics?.attendancePercentage ?? 0}%</strong>
                <span className="stat-card__helper">Verified students divided by enrolled roster</span>
              </div>
            </article>
            <article className="stat-card stat-card--neutral">
              <div className="stat-card__content">
                <span className="stat-card__label">Checked-in %</span>
                <strong className="stat-card__value">{analytics?.checkedInPercentage ?? 0}%</strong>
                <span className="stat-card__helper">Includes verified and pending check-ins</span>
              </div>
            </article>
          </section>

          <section className="content-grid report-layout">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Session details</span>
                  <h2>Report metadata</h2>
                </div>
                <StatusBadge status={getSessionStatus(session)} />
              </div>

              <dl className="settings-list">
                <div>
                  <dt>Course</dt>
                  <dd>{getSessionTitle(session)}</dd>
                </div>
                <div>
                  <dt>Lecturer</dt>
                  <dd>{session.lecturerId || 'Lecturer pending'}</dd>
                </div>
                <div>
                  <dt>Device</dt>
                  <dd>{session.device?.name || session.device?.deviceId || 'Device pending'}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{formatDateTime(session.startedAt)}</dd>
                </div>
                <div>
                  <dt>Ended</dt>
                  <dd>{formatDateTime(session.endedAt ?? session.expiresAt)}</dd>
                </div>
              </dl>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Quick facts</span>
                  <h2>Attendance breakdown</h2>
                </div>
              </div>

              <dl className="settings-list">
                <div>
                  <dt>Session ID</dt>
                  <dd>{session.id}</dd>
                </div>
                <div>
                  <dt>Attendance URL</dt>
                  <dd>{attendanceUrl}</dd>
                </div>
                <div>
                  <dt>Verified</dt>
                  <dd>{analytics?.verifiedCount ?? session.attendanceStats?.verified ?? 0}</dd>
                </div>
                <div>
                  <dt>Pending</dt>
                  <dd>{analytics?.pendingCount ?? session.attendanceStats?.pending ?? 0}</dd>
                </div>
                <div>
                  <dt>Present</dt>
                  <dd>{analytics?.presentCount ?? session.attendanceStats?.present ?? 0}</dd>
                </div>
                <div>
                  <dt>Absent</dt>
                  <dd>{analytics?.absentCount ?? 0}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{formatDurationMinutes(session)}</dd>
                </div>
              </dl>
            </article>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Absent roster</span>
                <h2>Students still missing</h2>
              </div>
            </div>

            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Matric Number</th>
                    <th>Department</th>
                    <th>Email</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {absentStudents.length > 0 ? (
                    absentStudents.map((student) => (
                      <tr key={student.id}>
                        <td>{student.fullName}</td>
                        <td>{student.matricNumber}</td>
                        <td>{student.department || 'Not available'}</td>
                        <td>{student.email || 'Not available'}</td>
                        <td>{student.phoneNumber || 'Not available'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="data-table__empty">
                        {analytics?.rosterAvailable
                          ? 'No absent students remain for this session.'
                          : 'Upload a class roster in Settings to calculate absentees.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Attendance list</span>
                <h2>Recorded students</h2>
              </div>
            </div>

            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Matric Number</th>
                    <th>Department</th>
                    <th>Phone</th>
                    <th>Requested</th>
                    <th>Verified</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.length > 0 ? (
                    attendanceRecords.map((record) => (
                      <tr key={record.id}>
                        <td>{record.fullName || record.name}</td>
                        <td>{record.matricNumber}</td>
                        <td>{record.department}</td>
                        <td>{record.phoneNumber || 'Not available'}</td>
                        <td>{formatTime(record.requestedAt)}</td>
                        <td>{formatTime(record.verifiedAt ?? record.checkInTime)}</td>
                        <td>
                          <StatusBadge status={record.attendanceStatus} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="data-table__empty">
                        No attendance rows were recorded for this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
