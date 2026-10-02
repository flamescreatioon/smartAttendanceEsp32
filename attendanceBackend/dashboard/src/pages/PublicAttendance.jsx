import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, KeyRound, LoaderCircle, Mail, Phone, School, Search, ShieldCheck, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import Countdown from '../components/Countdown.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import {
  getAttendanceSession,
  lookupAttendanceStudent,
  requestAttendanceOtp,
  verifyAttendanceOtp,
} from '../services/api.js';
import {
  formatDateTime,
  getLecturerName,
  getSessionTitle,
  getSessionStatus,
} from '../utils/format.js';

function buildInitialStudentForm() {
  return {
    firstName: '',
    lastName: '',
    matricNumber: '',
    department: '',
    email: '',
    phoneNumber: '',
  };
}

export default function PublicAttendance() {
  const { token = '' } = useParams();
  const [studentForm, setStudentForm] = useState(buildInitialStudentForm);
  const [studentLookup, setStudentLookup] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [requestedAttendance, setRequestedAttendance] = useState(null);
  const [verifiedAttendance, setVerifiedAttendance] = useState(null);
  const [devOtpCode, setDevOtpCode] = useState('');
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [deliveryChannel, setDeliveryChannel] = useState('');

  const sessionQuery = useQuery({
    queryKey: ['attendance-session', token],
    queryFn: () => getAttendanceSession(token),
    enabled: Boolean(token),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const requestOtpMutation = useMutation({
    mutationFn: (payload) => requestAttendanceOtp(token, payload),
    onSuccess: (response) => {
      const attendance = response.data?.attendance ?? null;
      const session = response.data?.session ?? null;
      const student = response.data?.student ?? null;
      const studentExistsFlag = response.data?.studentExists ?? false;

      setRequestedAttendance(attendance);
      setVerifiedAttendance(null);
      setDeliveryMessage(response.data?.delivery ?? 'OTP generated successfully.');
      setDeliveryChannel(response.data?.deliveryChannel ?? '');
      setDevOtpCode(response.data?.devOtpCode ?? '');
      setStudentLookup({
        exists: studentExistsFlag || Boolean(student),
        student,
      });
      if (session) {
        sessionQuery.refetch();
      }
      toast.success('OTP created. Continue with verification.');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? 'Unable to request OTP.');
    },
  });

  const lookupStudentMutation = useMutation({
    mutationFn: (matricNumber) => lookupAttendanceStudent(token, matricNumber),
    onSuccess: (result) => {
      setStudentLookup(result);

      if (result?.exists && result.student) {
        setStudentForm((currentForm) => ({
          ...currentForm,
          matricNumber: result.student.matricNumber ?? currentForm.matricNumber,
          firstName: result.student.firstName ?? '',
          lastName: result.student.lastName ?? '',
          department: result.student.department ?? '',
          email: result.student.email ?? '',
          phoneNumber: result.student.phoneNumber ?? '',
        }));
        toast.success('Student record found.');
        return;
      }

      setStudentForm((currentForm) => ({
        ...currentForm,
        firstName: '',
        lastName: '',
        department: '',
        email: '',
        phoneNumber: '',
      }));
      toast('No student record found. Complete registration to continue.');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? 'Unable to check this matric number.');
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (payload) => verifyAttendanceOtp(token, payload),
    onSuccess: (response) => {
      const attendance = response.data?.attendance ?? null;
      const session = response.data?.session ?? null;

      setVerifiedAttendance(attendance);
      setRequestedAttendance(attendance);
      if (session) {
        sessionQuery.refetch();
      }
      toast.success(response.message ?? 'Attendance verified.');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? 'Unable to verify OTP.');
    },
  });

  useEffect(() => {
    if (verifiedAttendance) {
      setOtpCode('');
    }
  }, [verifiedAttendance]);

  function updateStudentForm(fieldName, value) {
    setStudentForm((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }));

    if (fieldName === 'matricNumber') {
      setStudentLookup(null);
      setRequestedAttendance(null);
      setVerifiedAttendance(null);
      setOtpCode('');
      setDevOtpCode('');
      setDeliveryMessage('');
      setDeliveryChannel('');
    }
  }

  function handleLookupStudent(event) {
    event.preventDefault();

    if (!studentForm.matricNumber.trim()) {
      toast.error('Enter your matric number first.');
      return;
    }

    lookupStudentMutation.mutate(studentForm.matricNumber.trim());
  }

  function handleRequestOtp(event) {
    event.preventDefault();
    requestOtpMutation.mutate(studentForm);
  }

  function handleVerifyOtp(event) {
    event.preventDefault();
    verifyOtpMutation.mutate({
      matricNumber: studentForm.matricNumber,
      otpCode,
    });
  }

  const session = sessionQuery.data;
  const sessionStatus = getSessionStatus(session);
  const attendanceStats = session?.attendanceStats ?? {
    present: 0,
    pending: 0,
    verified: 0,
  };

  const showOtpStep = Boolean(requestedAttendance) && !verifiedAttendance;
  const isActive = session?.active;
  const studentExists = studentLookup?.exists === true;
  const studentLookupComplete = studentLookup !== null;

  return (
    <main className="public-shell">
      <section className="public-hero panel">
        <div className="eyebrow">Student attendance portal</div>
        <h1>{getSessionTitle(session)}</h1>
        <p>
          {session
            ? `Verify your presence for ${getLecturerName(session)} before the session window closes.`
            : 'Loading attendance session details.'}
        </p>

        <div className="public-hero__meta">
          <StatusBadge status={sessionStatus} />
          <div className="header-chip">
            <Clock3 size={16} />
            <span>{formatDateTime(session?.expiresAt)}</span>
          </div>
          <div className="header-chip">
            <ShieldCheck size={16} />
            <span>{attendanceStats.present} checked in</span>
          </div>
          <div className="header-chip">
            <CheckCircle2 size={16} />
            <span>{attendanceStats.verified} verified</span>
          </div>
        </div>

        <Countdown session={session} />
      </section>

      <section className="public-grid">
        <article className="panel public-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Step 1</span>
              <h2>Find your student record</h2>
            </div>
          </div>

          {sessionQuery.isLoading ? (
            <div className="public-state">
              <LoaderCircle className="spin" size={20} />
              <span>Loading attendance session...</span>
            </div>
          ) : null}

          {sessionQuery.isError ? (
            <div className="public-state public-state--error">
              {sessionQuery.error?.response?.data?.message ?? 'This attendance link is invalid or unavailable.'}
            </div>
          ) : null}

          {session && !isActive ? (
            <div className="public-state public-state--warning">
              This session is no longer accepting check-ins. Ask your lecturer for the latest QR code if needed.
            </div>
          ) : null}

          <form className="login-form" onSubmit={handleLookupStudent}>
            <label className="field">
              <span>Matric number</span>
              <div className="field__input">
                <KeyRound size={18} />
                <input
                  type="text"
                  value={studentForm.matricNumber}
                  onChange={(event) => updateStudentForm('matricNumber', event.target.value)}
                  placeholder="CE/21/001"
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              className="button button--ghost button--wide"
              disabled={!isActive || lookupStudentMutation.isPending}
            >
              <Search size={16} />
              <span>{lookupStudentMutation.isPending ? 'Checking matric...' : 'Find student record'}</span>
            </button>
          </form>

          {studentLookupComplete ? (
            <div className={`public-state ${studentExists ? 'public-state--success' : 'public-state--info'}`}>
              <ShieldCheck size={18} />
              <span>
                {studentExists
                  ? 'Existing student record found. Review your details, then request your OTP.'
                  : 'No record was found. Complete the registration details below to continue.'}
              </span>
            </div>
          ) : null}

          <form className="login-form" onSubmit={handleRequestOtp}>
            <label className="field">
              <span>First name</span>
              <div className="field__input">
                <UserRound size={18} />
                <input
                  type="text"
                  value={studentForm.firstName}
                  onChange={(event) => updateStudentForm('firstName', event.target.value)}
                  placeholder="John"
                  required={!studentExists}
                  disabled={!studentLookupComplete || studentExists}
                />
              </div>
            </label>

            <label className="field">
              <span>Last name</span>
              <div className="field__input">
                <UserRound size={18} />
                <input
                  type="text"
                  value={studentForm.lastName}
                  onChange={(event) => updateStudentForm('lastName', event.target.value)}
                  placeholder="Doe"
                  required={!studentExists}
                  disabled={!studentLookupComplete || studentExists}
                />
              </div>
            </label>

            <label className="field">
              <span>Department</span>
              <div className="field__input">
                <School size={18} />
                <input
                  type="text"
                  value={studentForm.department}
                  onChange={(event) => updateStudentForm('department', event.target.value)}
                  placeholder="Computer Engineering"
                  required={!studentExists}
                  disabled={!studentLookupComplete || studentExists}
                />
              </div>
            </label>

            <label className="field">
              <span>Institution email</span>
              <div className="field__input">
                <Mail size={18} />
                <input
                  type="email"
                  value={studentForm.email}
                  onChange={(event) => updateStudentForm('email', event.target.value)}
                  placeholder="student@school.edu"
                  required={!studentExists}
                  disabled={!studentLookupComplete || studentExists}
                />
              </div>
            </label>

            <label className="field">
              <span>Phone number</span>
              <div className="field__input">
                <Phone size={18} />
                <input
                  type="tel"
                  value={studentForm.phoneNumber}
                  onChange={(event) => updateStudentForm('phoneNumber', event.target.value)}
                  placeholder="+234 800 000 0000"
                  required={!studentExists}
                  disabled={!studentLookupComplete || studentExists}
                />
              </div>
            </label>

            <button
              type="submit"
              className="button button--primary button--wide"
              disabled={!isActive || !studentLookupComplete || requestOtpMutation.isPending}
            >
              <span>{requestOtpMutation.isPending ? 'Generating OTP...' : 'Request OTP'}</span>
            </button>
          </form>
        </article>

        <article className="panel public-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Step 2</span>
              <h2>Verify attendance</h2>
            </div>
          </div>

          {showOtpStep ? (
            <>
              <div className="public-state">
                <ShieldCheck size={18} />
                <span>{deliveryMessage}</span>
              </div>

              {deliveryChannel === 'email' ? (
                <div className="public-state public-state--success">
                  Check your email inbox and spam folder for the 6-digit code.
                </div>
              ) : null}

              {devOtpCode ? (
                <div className="public-state public-state--info">
                  Development OTP:
                  {' '}
                  <strong>{devOtpCode}</strong>
                </div>
              ) : null}

              <form className="login-form" onSubmit={handleVerifyOtp}>
                <label className="field">
                  <span>OTP code</span>
                  <div className="field__input">
                    <KeyRound size={18} />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength="6"
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value)}
                      placeholder="Enter the 6-digit OTP"
                      required
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  className="button button--primary button--wide"
                  disabled={!isActive || verifyOtpMutation.isPending}
                >
                  <span>{verifyOtpMutation.isPending ? 'Verifying...' : 'Verify attendance'}</span>
                </button>
              </form>
            </>
          ) : null}

          {!requestedAttendance && !verifiedAttendance ? (
            <div className="public-state">
              Find your record first. If you're new, register your details and request an OTP to unlock verification.
            </div>
          ) : null}

          {verifiedAttendance ? (
            <div className="public-success">
              <CheckCircle2 size={44} />
              <div>
                <h3>Attendance verified</h3>
                <p>
                  {verifiedAttendance.name}
                  {' '}
                  (
                  {verifiedAttendance.matricNumber}
                  ) has been recorded successfully.
                </p>
                <p>
                  Verified at
                  {' '}
                  <strong>{formatDateTime(verifiedAttendance.verifiedAt ?? verifiedAttendance.checkInTime)}</strong>
                </p>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
