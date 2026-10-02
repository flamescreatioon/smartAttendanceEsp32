import { useEffect, useState } from 'react';
import { CalendarDays, Cpu, LogOut, ShieldCheck, Wifi } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { formatDateTime, getLecturerName, getSessionStatus, getSessionTitle } from '../utils/format.js';

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
];

export default function Header({ auth, session, device: providedDevice = null, socketConnected, onLogout }) {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const device = providedDevice ?? session?.device ?? null;

  return (
    <header className="app-header panel">
      <div className="app-header__brand">
        <div className="brand-mark" aria-hidden="true">
          SA
        </div>
        <div>
          <span className="eyebrow">Smart Attendance Dashboard</span>
          <h1>Attendance control room</h1>
          <p>
            {session
              ? `${getSessionTitle(session)} / ${getLecturerName(session)}`
              : 'Watching for the next attendance session assigned to this terminal.'}
          </p>
        </div>
      </div>

      <div className="app-header__meta">
        <div className="header-chip">
          <ShieldCheck size={16} />
          <span>{auth?.operatorName || 'Lecturer Console'}</span>
        </div>
        <div className="header-chip">
          <Cpu size={16} />
          <span>{device?.deviceId || auth?.deviceId || 'Device ID pending'}</span>
        </div>
        <div className="header-chip">
          <Wifi size={16} />
          <span>
            {device
              ? (device.isOnline ? 'Device online' : 'Device offline')
              : (socketConnected ? 'Socket live' : 'Reconnecting socket')}
          </span>
        </div>
        <div className="header-chip">
          <CalendarDays size={16} />
          <span>{formatDateTime(currentTime)}</span>
        </div>
        <StatusBadge status={getSessionStatus(session)} />
      </div>

      <div className="app-header__footer">
        <nav className="nav-tabs" aria-label="Dashboard sections">
          {navigationItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) => (
                isActive ? 'nav-tab nav-tab--active' : 'nav-tab'
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="button button--ghost" onClick={onLogout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
