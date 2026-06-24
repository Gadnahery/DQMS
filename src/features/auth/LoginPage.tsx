import React, { useState } from 'react';
import { getSupabaseClient, api } from '../../shared/services/api';
import { useTheme } from '../../app/App';
import {
  Mail, Lock, User, Phone, Eye, EyeOff,
  ArrowLeft, Ticket, Sun, Moon, ArrowRight
} from 'lucide-react';

interface LoginPageProps {
  onNavigate: (view: string) => void;
}

type AuthTab = 'login' | 'signup' | 'forgot';

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const supabase = getSupabaseClient();

      if (tab === 'forgot') {
        if (supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
          });
          if (error) throw error;
          setSuccess('Password reset email sent! Check your inbox.');
        } else {
          setSuccess('Password reset email sent! (Demo mode)');
        }
        setLoading(false);
        return;
      }

      if (tab === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        if (supabase) {
          const { error } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: fullName, phone } }
          });
          if (error) throw error;
          setSuccess('Account created! Please check your email to verify.');
          localStorage.removeItem('dqms_guest_mode');
          localStorage.setItem('user_role', 'customer');
          setTimeout(() => onNavigate('customer'), 1800);
        } else {
          localStorage.removeItem('dqms_guest_mode');
          localStorage.setItem('user_role', 'customer');
          setSuccess('Account created! Redirecting...');
          setTimeout(() => onNavigate('customer'), 1000);
        }
      } else {
        // Login
        if (supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          
          localStorage.removeItem('dqms_guest_mode');
          let role = 'customer';
          if (data.user) {
            role = await api.getUserRole(data.user.id, data.user.email);
          }
          localStorage.setItem('user_role', role);
          setSuccess(`Signed in as ${role}! Redirecting...`);
          setTimeout(() => onNavigate(role), 800);
        } else {
          localStorage.removeItem('dqms_guest_mode');
          localStorage.setItem('user_role', 'customer');
          setSuccess('Signed in! Redirecting...');
          setTimeout(() => onNavigate('customer'), 800);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signInWithOAuth({ provider: 'google' });
    } else {
      localStorage.removeItem('dqms_guest_mode');
      localStorage.setItem('user_role', 'customer');
      onNavigate('customer');
    }
  };

  const handleGuest = () => {
    localStorage.setItem('dqms_guest_mode', 'true');
    onNavigate('customer');
  };

  return (
    <div className="login-page">
      {/* Theme toggle top-right */}
      <button
        onClick={toggleTheme}
        className="nav-theme-btn"
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 999 }}
      >
        {theme === 'dark'
          ? <Sun size={15} color="var(--text-muted)" />
          : <Moon size={15} color="var(--text-muted)" />}
      </button>

      <div className="login-card anim-scale-in">
        {/* Back to home */}
        <button
          className="back-link"
          onClick={() => onNavigate('welcome')}
          style={{ background: 'none', border: 'none' }}
        >
          <ArrowLeft size={15} />
          <span>Back to home</span>
        </button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 8px 24px var(--primary-glow)',
          }}>
            <Ticket size={26} color="#fff" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 4 }}>
            {tab === 'login' ? 'Welcome Back' : tab === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {tab === 'login'
              ? 'Sign in to access your queue portal'
              : tab === 'signup'
              ? 'Join the smart queue platform'
              : 'Enter your email to reset your password'}
          </p>
        </div>

        {/* Tab bar */}
        {tab !== 'forgot' && (
          <div className="auth-tab-bar">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); setSuccess(''); }}>
              Sign In
            </button>
            <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError(''); setSuccess(''); }}>
              Sign Up
            </button>
          </div>
        )}

        {/* Error / Success */}
        {error && <div className="alert-error anim-fade-in">{error}</div>}
        {success && <div className="alert-success anim-fade-in">{success}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="input-group">

            {tab === 'signup' && (
              <div className="input-wrap">
                <span className="input-icon"><User size={15} /></span>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            {tab === 'signup' && (
              <div className="input-wrap">
                <span className="input-icon"><Phone size={15} /></span>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="Phone Number (optional)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
            )}

            <div className="input-wrap">
              <span className="input-icon"><Mail size={15} /></span>
              <input
                className="form-input"
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {tab !== 'forgot' && (
              <div className="input-wrap">
                <span className="input-icon"><Lock size={15} /></span>
                <input
                  className="form-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="input-suffix"
                  onClick={() => setShowPass(!showPass)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            )}

            {tab === 'signup' && (
              <div className="input-wrap">
                <span className="input-icon"><Lock size={15} /></span>
                <input
                  className="form-input"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="input-suffix"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            )}
          </div>

          {/* Forgot password link */}
          {tab === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => { setTab('forgot'); setError(''); setSuccess(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? (
              <span className="spinner" />
            ) : (
              <>
                <ArrowRight size={16} />
                {tab === 'login' ? 'Sign In' : tab === 'signup' ? 'Create Account' : 'Send Reset Email'}
              </>
            )}
          </button>
        </form>

        {/* Forgot password back */}
        {tab === 'forgot' && (
          <button
            className="back-link"
            onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
            style={{ background: 'none', border: 'none', marginTop: 16, justifyContent: 'center' }}
          >
            <ArrowLeft size={15} />
            Back to Sign In
          </button>
        )}

        {/* Divider + Google */}
        {tab !== 'forgot' && (
          <>
            <div className="divider-or">OR</div>
            <button type="button" className="google-btn" onClick={handleGoogle}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.8 33.6 29.3 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.5 5 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.6 0 20-7.7 20-21 0-1.3-.1-2.7-.4-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.5 5 29.5 3 24 3 16.3 3 9.6 7.9 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 45c5.2 0 9.9-1.8 13.5-4.8l-6.2-5.1C29.4 36.5 26.8 37 24 37c-5.2 0-9.7-3.4-11.3-8H5.6C9 39.1 16 45 24 45z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.4-2.3 4.4-4.3 5.8l6.2 5.1C41.7 36 45 30.6 45 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Continue with Google
            </button>

            <button className="guest-btn" onClick={handleGuest}>
              👤 Continue as Guest — No account needed
            </button>
          </>
        )}

        {/* Footer text */}
        <p style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
          By continuing you agree to our{' '}
          <span style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>Terms</span>
          {' & '}
          <span style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>Privacy Policy</span>
        </p>

        {/* Staff portal hint */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-card)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 8 }}>Staff & Admin Access</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            {[
              { label: 'Staff', hash: 'staff' },
              { label: 'Supervisor', hash: 'supervisor' },
              { label: 'Admin', hash: 'admin' },
            ].map(({ label, hash }) => (
              <button
                key={hash}
                onClick={() => onNavigate(hash)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-subtle)',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
