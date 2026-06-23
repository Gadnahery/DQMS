import React, { useState, useEffect } from 'react';
import { api, getSupabaseClient } from '../../shared/services/api';
import type { Ticket } from '../../types';
import { useTheme } from '../../app/App';
import {
  PhoneCall, RotateCcw, ArrowLeftRight, CheckCircle2,
  SkipForward, LogOut, Sun, Moon,
  User, Users, TrendingUp, ChevronDown,
  AlertCircle, Ticket as TicketIcon
} from 'lucide-react';

interface StaffPortalProps {
  onNavigate: (view: string) => void;
}

export const StaffPortal: React.FC<StaffPortalProps> = ({ onNavigate }) => {
  const { theme, toggleTheme } = useTheme();

  // Auth state
  const [loggedIn, setLoggedIn] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [counterId, setCounterId] = useState('1');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Console state
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    try {
      const tickets = await api.getTickets();
      setAllTickets(tickets);
      const today = new Date().toISOString().split('T')[0];
      const todayTickets = tickets.filter(t => t.created_at.startsWith(today));
      setWaitingCount(tickets.filter(t => t.status === 'waiting').length);
      setCompletedCount(todayTickets.filter(t => t.status === 'completed').length);
      const serving = tickets.find(t => t.status === 'serving' && t.counter_assigned === Number(counterId));
      if (serving) setCurrentTicket(serving);
    } catch (err) { /* quiet */ }
  };

  useEffect(() => {
    if (!loggedIn) return;
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loggedIn, counterId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('System is not connected to database');

      const { data, error } = await supabase.auth.signInWithPassword({
        email: employeeId,
        password: password
      });

      if (error) throw error;
      
      if (data.user) {
        const role = await api.getUserRole(data.user.id);
        if (['admin', 'supervisor', 'staff'].includes(role)) {
          setLoggedIn(true);
        } else {
          await supabase.auth.signOut();
          setLoginError('Access restricted. Staff privileges required.');
        }
      }
    } catch (err: any) {
      setLoginError(err.message || 'Invalid credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCallNext = async () => {
    setActionLoading('call');
    try {
      const ticket = await api.callNextTicket(Number(counterId), undefined);
      setCurrentTicket(ticket);
      // Voice announcement
      const utterance = new SpeechSynthesisUtterance(
        `Now serving ticket number ${ticket.ticket_number}. Please proceed to counter ${counterId}.`
      );
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
      showToast(`Called: ${ticket.ticket_number}`);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'No customers waiting', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecall = () => {
    if (!currentTicket) { showToast('No active ticket to recall', 'error'); return; }
    const utterance = new SpeechSynthesisUtterance(
      `Recall: Ticket number ${currentTicket.ticket_number}. Please proceed to counter ${counterId}.`
    );
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
    showToast(`Recalled: ${currentTicket.ticket_number}`);
  };

  const handleComplete = async () => {
    if (!currentTicket) { showToast('No active ticket', 'error'); return; }
    setActionLoading('complete');
    try {
      await api.updateTicketStatus(currentTicket.id, 'completed');
      showToast('✓ Service completed!');
      setCurrentTicket(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSkip = async () => {
    if (!currentTicket) { showToast('No active ticket', 'error'); return; }
    setActionLoading('skip');
    try {
      await api.updateTicketStatus(currentTicket.id, 'cancelled');
      showToast('Ticket skipped');
      setCurrentTicket(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransfer = () => {
    showToast('Transfer feature — connect to supervisor panel');
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setCurrentTicket(null);
    setEmployeeId('');
    setPassword('');
  };

  const nextTicket = allTickets.find(t => t.status === 'waiting');

  // ── Login Screen ─────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <button
          onClick={toggleTheme}
          className="nav-theme-btn"
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 999 }}
        >
          {theme === 'dark' ? <Sun size={15} color="var(--text-muted)" /> : <Moon size={15} color="var(--text-muted)" />}
        </button>

        <div className="login-card anim-scale-in" style={{ maxWidth: 400 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', boxShadow: '0 8px 24px var(--primary-glow)',
            }}>
              <TicketIcon size={28} color="#fff" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 4 }}>Staff Portal</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sign in with your employee credentials</p>
          </div>

          {loginError && <div className="alert-error">{loginError}</div>}

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <div className="input-wrap">
                <span className="input-icon"><User size={15} /></span>
                <input
                  className="form-input"
                  type="email"
                  placeholder="Email Address"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  required
                />
              </div>
              <div className="input-wrap">
                <span className="input-icon"><User size={15} /></span>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="input-wrap">
                <span className="input-icon" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', left: 12 }}>#</span>
                <input
                  className="form-input"
                  type="number"
                  placeholder="Counter Number"
                  value={counterId}
                  onChange={e => setCounterId(e.target.value)}
                  min={1} max={20}
                  required
                />
              </div>
            </div>
            <button type="submit" className="submit-btn" disabled={loginLoading}>
              {loginLoading ? <span className="spinner" /> : '→'}&nbsp;
              {loginLoading ? 'Signing in...' : 'Sign In to Console'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20 }}>
            <button
              onClick={() => onNavigate('welcome')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-subtle)' }}
            >
              ← Home
            </button>
            <button
              onClick={() => onNavigate('admin')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-subtle)' }}
            >
              Admin Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Console ──────────────────────────────────────────────────
  return (
    <div className="staff-page">

      {/* Toast */}
      {toast && (
        <div className="anim-slide-right" style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: '#fff', padding: '12px 20px', borderRadius: 'var(--radius-sm)',
          fontWeight: 700, fontSize: 14, boxShadow: 'var(--shadow-lg)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="staff-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TicketIcon size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-heading)' }}>DQMS Staff</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{employeeId}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="counter-pill">
            <div className="status-dot" />
            Counter {counterId}
          </div>
          <button className="nav-theme-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={14} color="var(--text-muted)" /> : <Moon size={14} color="var(--text-muted)" />}
          </button>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Console body */}
      <div className="staff-console">

        {/* Stat cards */}
        <div className="staff-stats-grid">
          <div className="staff-stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <User size={14} color="var(--primary)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Now Serving</span>
            </div>
            <div className="staff-stat-value" style={{ color: 'var(--primary)' }}>
              {currentTicket?.ticket_number ?? '—'}
            </div>
            <div className="staff-stat-label">{currentTicket?.customer_name ?? 'No active customer'}</div>
          </div>

          <div className="staff-stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ChevronDown size={14} color="var(--secondary)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Next Up</span>
            </div>
            <div className="staff-stat-value" style={{ color: 'var(--secondary)' }}>
              {nextTicket?.ticket_number ?? '—'}
            </div>
            <div className="staff-stat-label">{nextTicket?.customer_name ?? 'Queue empty'}</div>
          </div>

          <div className="staff-stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Users size={14} color="var(--warning)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Waiting</span>
            </div>
            <div className="staff-stat-value" style={{ color: 'var(--warning)' }}>{waitingCount}</div>
            <div className="staff-stat-label">In queue now</div>
          </div>

          <div className="staff-stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <TrendingUp size={14} color="var(--success)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Completed</span>
            </div>
            <div className="staff-stat-value" style={{ color: 'var(--success)' }}>{completedCount}</div>
            <div className="staff-stat-label">Served today</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="staff-actions-grid">
          {/* Call Next — full width, biggest */}
          <button
            className="staff-action-btn call-next"
            onClick={handleCallNext}
            disabled={actionLoading === 'call'}
          >
            {actionLoading === 'call' ? <span className="spinner" /> : <PhoneCall size={22} />}
            Call Next Customer
          </button>

          <button
            className="staff-action-btn recall"
            onClick={handleRecall}
            disabled={!currentTicket}
          >
            <RotateCcw size={18} />
            Recall
          </button>

          <button
            className="staff-action-btn transfer"
            onClick={handleTransfer}
            disabled={!currentTicket}
          >
            <ArrowLeftRight size={18} />
            Transfer
          </button>

          <button
            className="staff-action-btn complete"
            onClick={handleComplete}
            disabled={!currentTicket || actionLoading === 'complete'}
          >
            {actionLoading === 'complete' ? <span className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }} /> : <CheckCircle2 size={18} />}
            Complete
          </button>

          <button
            className="staff-action-btn skip"
            onClick={handleSkip}
            disabled={!currentTicket || actionLoading === 'skip'}
          >
            <SkipForward size={18} />
            Skip
          </button>
        </div>

        {/* Current customer detail card */}
        <div className="customer-detail-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Customer Details</div>
            {currentTicket && (
              <span className="ticket-status-badge serving">Now Serving</span>
            )}
          </div>
          {currentTicket ? (
            <div className="customer-detail-grid">
              <div className="detail-item">
                <div className="detail-label">Ticket</div>
                <div className="detail-value" style={{ color: 'var(--primary)' }}>{currentTicket.ticket_number}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Name</div>
                <div className="detail-value">{currentTicket.customer_name || 'Walk-in'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Service</div>
                <div className="detail-value">{currentTicket.services?.name || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Wait Time</div>
                <div className="detail-value">
                  {currentTicket.called_at
                    ? `${Math.round((Date.now() - new Date(currentTicket.called_at).getTime()) / 60000)} min`
                    : '—'}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Phone</div>
                <div className="detail-value">{currentTicket.customer_phone || 'Not provided'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Priority</div>
                <div className="detail-value" style={{ textTransform: 'capitalize' }}>{currentTicket.priority}</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontSize: 14 }}>No customer being served</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Press "Call Next Customer" to begin</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
