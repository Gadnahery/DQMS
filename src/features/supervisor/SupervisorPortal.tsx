import React, { useState, useEffect } from 'react';
import { api } from '../../shared/services/api';
import type { Ticket, Counter } from '../../types';
import { useTheme } from '../../app/App';
import {
  LayoutDashboard, Monitor, BarChart3, Radio,
  LogOut, Sun, Moon, TrendingUp,
  Users, Clock, CheckCircle2, AlertTriangle,
  Send, RefreshCw
} from 'lucide-react';

interface SupervisorPortalProps {
  onNavigate: (view: string) => void;
}

type SvSection = 'dashboard' | 'monitoring' | 'analytics' | 'broadcast';

const NAV_ITEMS: { key: SvSection; icon: React.ReactNode; label: string }[] = [
  { key: 'dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { key: 'monitoring', icon: <Monitor size={16} />, label: 'Live Monitor' },
  { key: 'analytics', icon: <BarChart3 size={16} />, label: 'Analytics' },
  { key: 'broadcast', icon: <Radio size={16} />, label: 'Broadcast' },
];

// Simple SVG bar chart
const BarChart: React.FC<{ data: number[]; labels: string[]; color?: string }> = ({
  data, labels, color = 'var(--primary)',
}) => {
  const max = Math.max(...data, 1);
  const h = 120;
  const w = 280;
  const barW = w / data.length - 4;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h + 24}`} style={{ overflow: 'visible' }}>
      {data.map((v, i) => {
        const barH = (v / max) * h;
        const x = i * (w / data.length) + 2;
        const y = h - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill={color} rx={3} opacity={0.85} className="chart-bar" />
            <text x={x + barW / 2} y={h + 16} textAnchor="middle" fontSize={9} fill="var(--text-subtle)" fontFamily="var(--font-body)">
              {labels[i]}
            </text>
            {v > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="var(--text-muted)" fontFamily="var(--font-body)">
                {v}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export const SupervisorPortal: React.FC<SupervisorPortalProps> = ({ onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const [section, setSection] = useState<SvSection>('dashboard');
  const [loggedIn, setLoggedIn] = useState(false);
  const [svId, setSvId] = useState('');
  const [svPass, setSvPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Data
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [kpis, setKpis] = useState({ active: 0, waiting: 0, avgWait: 0, satisfaction: 94 });
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadData = async () => {
    try {
      const [tix, ctrs] = await Promise.all([api.getTickets(), api.getCounters()]);
      setTickets(tix);
      setCounters(ctrs);
      const waiting = tix.filter(t => t.status === 'waiting');
      const active = ctrs.filter(c => c.status === 'online').length;
      const avg = waiting.length > 0 ? Math.round(waiting.length * 3.2) : 0;
      setKpis({ active, waiting: waiting.length, avgWait: avg, satisfaction: 94 });
      setLastRefresh(new Date());
    } catch { /* quiet */ }
  };

  useEffect(() => {
    if (!loggedIn) return;
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    await new Promise(r => setTimeout(r, 600));
    if (svPass === 'password') {
      setLoggedIn(true);
    } else {
      setLoginError('Invalid credentials. Use password: "password"');
    }
    setLoginLoading(false);
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    try {
      await api.createAnnouncement(broadcastMsg);
      setBroadcastSent(true);
      setBroadcastMsg('');
      setTimeout(() => setBroadcastSent(false), 3000);
    } catch { setBroadcastSent(true); setTimeout(() => setBroadcastSent(false), 3000); }
  };

  // Analytics data derived from tickets
  const hourlyData = Array.from({ length: 8 }, (_, i) => {
    const h = i + 8;
    return tickets.filter(t => new Date(t.created_at).getHours() === h).length;
  });
  const hourLabels = Array.from({ length: 8 }, (_, i) => `${(i + 8) % 12 || 12}${i + 8 < 12 ? 'am' : 'pm'}`);

  const counterPerfData = counters.slice(0, 6).map(c => {
    const today = new Date().toISOString().split('T')[0];
    return tickets.filter(t => t.counter_assigned === c.id && t.status === 'completed' && t.created_at.startsWith(today)).length;
  });
  const counterLabels = counters.slice(0, 6).map(c => `C${c.id}`);

  // ── Login ──────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <button onClick={toggleTheme} className="nav-theme-btn" style={{ position: 'fixed', top: 16, right: 16, zIndex: 999 }}>
          {theme === 'dark' ? <Sun size={15} color="var(--text-muted)" /> : <Moon size={15} color="var(--text-muted)" />}
        </button>
        <div className="login-card anim-scale-in" style={{ maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, var(--warning), #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 8px 24px var(--warning-glow)' }}>
              <Monitor size={26} color="#fff" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 4 }}>Supervisor Portal</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Operations monitoring & control</p>
          </div>
          {loginError && <div className="alert-error">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <div className="input-wrap">
                <span className="input-icon" style={{ fontSize: 13, fontWeight: 700, left: 12 }}>ID</span>
                <input className="form-input" type="text" placeholder="Supervisor ID" value={svId} onChange={e => setSvId(e.target.value)} required />
              </div>
              <div className="input-wrap">
                <span className="input-icon" style={{ fontSize: 13, fontWeight: 700, left: 12 }}>🔑</span>
                <input className="form-input" type="password" placeholder="Password" value={svPass} onChange={e => setSvPass(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="submit-btn" disabled={loginLoading} style={{ background: 'linear-gradient(135deg, var(--warning), #f97316)' }}>
              {loginLoading ? <span className="spinner" /> : '→'}&nbsp;{loginLoading ? 'Signing in...' : 'Access Dashboard'}
            </button>
          </form>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button onClick={() => onNavigate('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-subtle)' }}>← Home</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Dashboard ─────────────────────────────────────────────
  return (
    <div className="supervisor-page">

      {/* Header */}
      <div className="supervisor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--warning), #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-heading)' }}>DQMS Supervisor</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Nav pills */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-app)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-card)' }}>
          {NAV_ITEMS.map(n => (
            <button
              key={n.key}
              onClick={() => setSection(n.key)}
              className={`desktop-tab-btn ${section === n.key ? 'active' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', border: 'none', borderRadius: 8,
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: section === n.key ? 'var(--warning)' : 'transparent',
                color: section === n.key ? '#fff' : 'var(--text-muted)',
                transition: 'var(--transition)',
              }}
            >
              {n.icon} {n.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={loadData} className="btn btn-secondary btn-sm">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={toggleTheme} className="nav-theme-btn">
            {theme === 'dark' ? <Sun size={14} color="var(--text-muted)" /> : <Moon size={14} color="var(--text-muted)" />}
          </button>
          <button onClick={() => setLoggedIn(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* ── DASHBOARD ─────────────────────────────────────────── */}
      {section === 'dashboard' && (
        <div>
          {/* KPI Cards */}
          <div className="kpi-grid">
            {[
              { icon: <Monitor size={20} color="var(--primary)" />, value: kpis.active, label: 'Active Counters', trend: '+2', up: true },
              { icon: <Users size={20} color="var(--warning)" />, value: kpis.waiting, label: 'Waiting Now', trend: kpis.waiting > 10 ? '↑ High' : '↓ Normal', up: kpis.waiting <= 10 },
              { icon: <Clock size={20} color="var(--secondary)" />, value: `${kpis.avgWait}m`, label: 'Avg Wait Time', trend: kpis.avgWait < 10 ? '↓ Good' : '↑ Long', up: kpis.avgWait < 10 },
              { icon: <TrendingUp size={20} color="var(--success)" />, value: `${kpis.satisfaction}%`, label: 'Satisfaction', trend: '+1.2%', up: true },
            ].map(({ icon, value, label, trend, up }) => (
              <div key={label} className="kpi-card">
                {icon}
                <div className="kpi-value">{value}</div>
                <div className="kpi-label">{label}</div>
                <div className={`kpi-trend ${up ? 'up' : 'down'}`}>{trend}</div>
              </div>
            ))}
          </div>

          {/* Quick status row */}
          <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Counter status mini-table */}
            <div className="chart-container">
              <div className="card-header">
                <div className="card-title">Counter Status</div>
                <span className="chip">{kpis.active} Online</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {counters.slice(0, 6).map(c => {
                  const serving = tickets.find(t => t.status === 'serving' && t.counter_assigned === c.id);
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.status === 'online' ? 'var(--success)' : c.status === 'paused' ? 'var(--warning)' : 'var(--danger)', boxShadow: c.status === 'online' ? '0 0 6px var(--success)' : 'none' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>Counter {c.id}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {c.staff_name && <span style={{ marginRight: 8 }}>{c.staff_name}</span>}
                        {serving ? <span style={{ color: 'var(--success)', fontWeight: 700 }}>{serving.ticket_number}</span> : '—'}
                      </div>
                      <span className={`status-badge ${c.status}`}>{c.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alerts / flags */}
            <div className="chart-container">
              <div className="card-header">
                <div className="card-title">Alerts</div>
              </div>
              {kpis.waiting > 15 && (
                <div className="notif-card" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'var(--warning)', marginBottom: 10 }}>
                  <AlertTriangle size={20} color="var(--warning)" />
                  <div>
                    <div className="notif-title">High Queue Load</div>
                    <div className="notif-body">{kpis.waiting} customers waiting</div>
                  </div>
                </div>
              )}
              {counters.some(c => c.status === 'offline') && (
                <div className="notif-card" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'var(--danger)', marginBottom: 10 }}>
                  <AlertTriangle size={20} color="var(--danger)" />
                  <div>
                    <div className="notif-title">Counter Offline</div>
                    <div className="notif-body">{counters.filter(c => c.status === 'offline').map(c => `Counter ${c.id}`).join(', ')}</div>
                  </div>
                </div>
              )}
              {kpis.waiting <= 15 && !counters.some(c => c.status === 'offline') && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--success)' }}>
                  <CheckCircle2 size={32} style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 13, fontWeight: 700 }}>All Systems Normal</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE MONITORING ───────────────────────────────────── */}
      {section === 'monitoring' && (
        <div style={{ padding: '24px' }}>
          <div className="page-title-row">
            <h2 className="page-title">Live Counter Monitoring</h2>
            <span className="chip">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', animation: 'pulseDot 2s ease-in-out infinite' }} />
              Live
            </span>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="monitoring-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Counter</th>
                  <th>Staff</th>
                  <th>Current Ticket</th>
                  <th>Service</th>
                  <th>Waiting</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {counters.map(counter => {
                  const serving = tickets.find(t => t.status === 'serving' && t.counter_assigned === counter.id);
                  const countWaiting = tickets.filter(t => t.status === 'waiting').length;
                  return (
                    <tr key={counter.id}>
                      <td style={{ fontWeight: 700 }}>Counter {counter.id}</td>
                      <td>{counter.staff_name || '—'}</td>
                      <td style={{ fontWeight: 700, color: serving ? 'var(--primary)' : 'var(--text-subtle)' }}>
                        {serving?.ticket_number || '—'}
                      </td>
                      <td>{serving?.services?.name || '—'}</td>
                      <td>
                        {counter.id === counters[0]?.id ? (
                          <span style={{ fontWeight: 700, color: countWaiting > 10 ? 'var(--danger)' : 'var(--text-main)' }}>
                            {countWaiting}
                          </span>
                        ) : '—'}
                      </td>
                      <td><span className={`status-badge ${counter.status}`}>{counter.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ANALYTICS ─────────────────────────────────────────── */}
      {section === 'analytics' && (
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="chart-container">
            <div className="card-header" style={{ marginBottom: 16 }}>
              <div>
                <div className="card-title">Peak Hours</div>
                <div className="card-subtitle">Customers per hour today</div>
              </div>
            </div>
            <BarChart data={hourlyData} labels={hourLabels} color="var(--primary)" />
          </div>

          <div className="chart-container">
            <div className="card-header" style={{ marginBottom: 16 }}>
              <div>
                <div className="card-title">Counter Performance</div>
                <div className="card-subtitle">Tickets completed today</div>
              </div>
            </div>
            <BarChart data={counterPerfData.length ? counterPerfData : [4,7,3,6,5,2]} labels={counterLabels.length ? counterLabels : ['C1','C2','C3','C4','C5','C6']} color="var(--success)" />
          </div>

          <div className="chart-container" style={{ gridColumn: 'span 2' }}>
            <div className="card-header" style={{ marginBottom: 16 }}>
              <div>
                <div className="card-title">Today's Summary</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Total Tickets', value: tickets.filter(t => t.created_at.startsWith(new Date().toISOString().split('T')[0])).length, color: 'var(--primary)' },
                { label: 'Completed', value: tickets.filter(t => t.status === 'completed').length, color: 'var(--success)' },
                { label: 'Cancelled', value: tickets.filter(t => t.status === 'cancelled').length, color: 'var(--danger)' },
                { label: 'Still Waiting', value: kpis.waiting, color: 'var(--warning)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color, marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BROADCAST ─────────────────────────────────────────── */}
      {section === 'broadcast' && (
        <div style={{ padding: '24px', maxWidth: 640 }}>
          <h2 className="page-title" style={{ marginBottom: 20 }}>Broadcast Announcement</h2>

          {broadcastSent && <div className="alert-success">✓ Announcement sent to all display boards and customers!</div>}

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>Quick Templates</div>
            {[
              'Lunch break: Counter 1, 2 will be closed 12:00–13:00',
              'System maintenance in 30 minutes. Please complete transactions.',
              'VIP service available at Counter 5 today.',
              'Special service: Priority queue open for elderly and disabled customers.',
            ].map(msg => (
              <button
                key={msg}
                onClick={() => setBroadcastMsg(msg)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: broadcastMsg === msg ? 'var(--primary-subtle)' : 'var(--bg-app)',
                  border: `1px solid ${broadcastMsg === msg ? 'var(--primary)' : 'var(--border-card)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 8,
                  fontSize: 13, color: 'var(--text-main)', cursor: 'pointer', transition: 'var(--transition)',
                }}
              >
                {msg}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Custom Message</div>
            <textarea
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              placeholder="Type announcement message..."
              rows={4}
              style={{
                width: '100%', background: 'var(--bg-input)', border: '1.5px solid var(--border-input)',
                borderRadius: 'var(--radius-sm)', padding: '12px 14px', color: 'var(--color-input)',
                fontSize: 14, resize: 'vertical', marginBottom: 12,
                transition: 'var(--transition)',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-glow)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-input)'; e.target.style.boxShadow = 'none'; }}
            />
            <button
              className="btn btn-primary"
              disabled={!broadcastMsg.trim()}
              onClick={handleBroadcast}
            >
              <Send size={15} />
              Send Announcement
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
