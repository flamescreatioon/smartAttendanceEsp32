import { startTransition, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, KeyRound, Mail, RadioTower, ShieldCheck, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { loginDashboard } from '../services/api.js';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState({
    email: '',
    password: '',
  });

  const loginMutation = useMutation({
    mutationFn: (payload) => loginDashboard(payload),
    onSuccess: (response) => {
      const device = response.device ?? {};
      const user = response.user ?? {};

      onLogin({
        token: response.token,
        operatorName: user.fullName || 'Lecturer Console',
        email: user.email || '',
        role: user.role || '',
        deviceName: device.name || '',
        deviceLocation: device.location || '',
        deviceId: device.deviceId || '',
      });

      toast.success('Dashboard unlocked.');
      startTransition(() => {
        navigate('/dashboard', { replace: true });
      });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? 'Unable to sign in.');
    },
  });

  function handleSubmit(event) {
    event.preventDefault();
    loginMutation.mutate(formValues);
  }

  function updateField(fieldName, value) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  }

  return (
    <main className="login-shell">
      <section className="login-panel login-panel--hero">
        <div className="eyebrow">Modern operations dashboard</div>
        <h1>Run attendance like a live control room.</h1>
        <p>
          This dashboard starts sessions for the terminal, shows the QR code instantly, and
          keeps the timer and roster in sync without refreshing the page.
        </p>

        <div className="feature-list">
          <article className="feature-card">
            <Sparkles size={18} />
            <div>
              <strong>Instant QR display</strong>
              <span>When you start a session here, the QR code appears immediately.</span>
            </div>
          </article>
          <article className="feature-card">
            <RadioTower size={18} />
            <div>
              <strong>Real-time events</strong>
              <span>Socket.IO keeps the room view updated as activity happens.</span>
            </div>
          </article>
          <article className="feature-card">
            <ShieldCheck size={18} />
            <div>
              <strong>User-based access</strong>
              <span>Lecturers sign in with their own dashboard credentials instead of the device secret.</span>
            </div>
          </article>
        </div>
      </section>

      <section className="login-panel login-panel--form">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Secure access</span>
            <h2>Sign in to the dashboard</h2>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email address</span>
            <div className="field__input">
              <Mail size={18} />
              <input
                type="email"
                value={formValues.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="lecturer@school.edu"
                autoComplete="username"
                required
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="field__input">
              <KeyRound size={18} />
              <input
                type="password"
                value={formValues.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder="Enter your dashboard password"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          <button
            type="submit"
            className="button button--primary button--wide"
            disabled={loginMutation.isPending}
          >
            <span>{loginMutation.isPending ? 'Validating access...' : 'Enter dashboard'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="login-note">
          The login step now authenticates against
          {' '}
          <code>POST /api/auth/login</code>
          {' '}
          and the backend keeps device credentials reserved for the ESP32 only.
        </p>
      </section>
    </main>
  );
}
