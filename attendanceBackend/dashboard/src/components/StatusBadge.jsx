import { getStatusTone, humanizeStatus } from '../utils/format.js';

export default function StatusBadge({ status, tone, children }) {
  const resolvedTone = tone ?? getStatusTone(status);
  const label = children ?? humanizeStatus(status);

  return (
    <span className={`status-badge status-badge--${resolvedTone}`}>
      {label}
    </span>
  );
}
