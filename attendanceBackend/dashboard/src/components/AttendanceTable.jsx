import StatusBadge from './StatusBadge.jsx';
import { formatTime } from '../utils/format.js';

export default function AttendanceTable({ attendanceRecords }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Live attendance</span>
          <h2>Attendance table</h2>
        </div>
        <div className="table-count-pill">
          <strong>{attendanceRecords.length}</strong>
          <span>records</span>
        </div>
      </div>

      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Matric Number</th>
              <th>Department</th>
              <th>Check-in Time</th>
              <th>OTP Status</th>
              <th>Attendance Status</th>
            </tr>
          </thead>
          <tbody>
            {attendanceRecords.length > 0 ? (
              attendanceRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.name}</td>
                  <td>{record.matricNumber}</td>
                  <td>{record.department}</td>
                  <td>{formatTime(record.checkInTime)}</td>
                  <td>
                    <StatusBadge status={record.otpStatus} />
                  </td>
                  <td>
                    <StatusBadge status={record.attendanceStatus} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="data-table__empty">
                  Students will appear here as soon as they request and verify attendance for the active session.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
