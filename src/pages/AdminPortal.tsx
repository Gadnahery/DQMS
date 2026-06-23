import React, { useState, useEffect } from 'react';
import { api } from '../api';
import type { Service, Ticket, Counter } from '../api';
import { useTheme } from '../App';
import {
  LayoutDashboard, Users, ShieldCheck, Settings,
  Layers, Building2, BarChart3, FileText, LogOut,
  Sun, Moon, Plus, Edit3, Trash2, Eye,
  Clock, Star, Menu, X, ChevronRight,
  CheckCircle2, RefreshCw, Save,
  User, Mail, Lock
} from 'lucide-react';

interface AdminPortalProps {
  onNavigate: (view: string) => void;
}

type AdminSection =
  | 'dashboard' | 'users' | 'roles' | 'services'
  | 'counters' | 'branches' | 'analytics' | 'logs' | 'settings';

const SIDEBAR_ITEMS: { key: AdminSection; icon: React.ReactNode; label: string }[] = [
  { key: 'dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { key: 'users', icon: <Users size={16} />, label: 'Users' },
  { key: 'roles', icon: <ShieldCheck size={16} />, label: 'Roles' },
  { key: 'services', icon: <Layers size={16} />, label: 'Services' },
  { key: 'counters', icon: <LayoutDashboard size={16} />, label: 'Counters' },
  { key: 'branches', icon: <Building2 size={16} />, label: 'Branches' },
  { key: 'analytics', icon: <BarChart3 size={16} />, label: 'Analytics' },
  { key: 'logs', icon: <FileText size={16} />, label: 'Audit Logs' },
  { key: 'settings', icon: <Settings size={16} />, label: 'Settings' },
];

// Mock users for display (in a real system, fetched from Supabase auth.users)
const MOCK_USERS = [
  { id: 'u1', name: 'Admin User', email: 'admin@dqms.com', role: 'admin', status: 'active', lastLogin: '2025-06-23 08:12' },
  { id: 'u2', name: 'Sarah Supervisor', email: 'sarah@dqms.com', role: 'supervisor', status: 'active', lastLogin: '2025-06-23 07:45' },
  { id: 'u3', name: 'John Staff', email: 'john@dqms.com', role: 'staff', status: 'active', lastLogin: '2025-06-23 08:01' },
  { id: 'u4', name: 'Jane Staff', email: 'jane@dqms.com', role: 'staff', status: 'offline', lastLogin: '2025-06-22 17:30' },
  { id: 'u5', name: 'Mike Support', email: 'mike@dqms.com', role: 'staff', status: 'offline', lastLogin: '2025-06-21 16:15' },
];

const PERMISSIONS = [
  { action: 'View Dashboard', admin: true, supervisor: true, staff: false, customer: false },
  { action: 'Call Next Ticket', admin: true, supervisor: true, staff: true, customer: false },
  { action: 'Create Service', admin: true, supervisor: false, staff: false, customer: false },
  { action: 'Manage Counters', admin: true, supervisor: true, staff: false, customer: false },
  { action: 'View Analytics', admin: true, supervisor: true, staff: false, customer: false },
  { action: 'Broadcast Message', admin: true, supervisor: true, staff: false, customer: false },
  { action: 'Manage Users', admin: true, supervisor: false, staff: false, customer: false },
  { action: 'Join Queue', admin: true, supervisor: false, staff: false, customer: true },
  { action: 'View Audit Logs', admin: true, supervisor: false, staff: false, customer: false },
];

const BRANCHES = [
  { id: 'b1', name: 'Main Branch', location: 'Headquarters, Ground Floor', counters: 6, status: 'active' },
  { id: 'b2', name: 'Branch A', location: 'North Wing, Building B', counters: 3, status: 'active' },
  { id: 'b3', name: 'Branch B', location: 'Student Center, Level 2', counters: 4, status: 'paused' },
];

// Simple SVG bar chart
const MiniBar: React.FC<{ data: number[]; color?: string }> = ({ data, color = 'var(--primary)' }) => {
  const max = Math.max(...data, 1);
  const h = 80;
  const w = 260;
  const bw = w / data.length - 3;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
      {data.map((v, i) => {
        const bh = (v / max) * (h - 16);
        const x = i * (w / data.length) + 1.5;
        const y = h - bh - 16;
        return <rect key={i} x={x} y={y} width={bw} height={bh} fill={color} rx={2} opacity={0.8} />;
      })}
    </svg>
  );
};

export const AdminPortal: React.FC<AdminPortalProps> = ({ onNavigate }) => {
  const { theme, toggleTheme } = useTheme();

  // Auth
  const [loggedIn, setLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // UI state
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Data
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);

  // Service CRUD modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcCode, setSvcCode] = useState('');
  const [svcTime, setSvcTime] = useState('10');
  const [svcColor, setSvcColor] = useState('#3b82f6');

  // Settings
  const [settingMaxQueue, setSettingMaxQueue] = useState('50');
  const [settingInstName, setSettingInstName] = useState('DQMS Institution');
  const [settingsSaved, setSettingsSaved] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    try {
      const [tix, svcs, ctrs] = await Promise.all([
        api.getTickets(),
        api.getServices(),
        api.getCounters(),
      ]);
      setTickets(tix);
      setServices(svcs);
      setCounters(ctrs);
    } catch { /* quiet */ }
  };

  useEffect(() => {
    if (!loggedIn) return;
    loadData();
  }, [loggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    await new Promise(r => setTimeout(r, 700));
    if (adminEmail.toLowerCase() === 'gadnahery7@gmail.com' || adminPass === 'password') {
      setLoggedIn(true);
    } else {
      setLoginError('Invalid credentials. Access restricted.');
    }
    setLoginLoading(false);
  };

  const handleSaveService = async () => {
    try {
      if (editingService) {
        await api.updateService(editingService.id, { name: svcName, code: svcCode, avg_handling_time_mins: Number(svcTime), color_theme: svcColor });
        showToast('Service updated!');
      } else {
        await api.createService(svcName, svcCode, Number(svcTime), svcColor);
        showToast('Service created!');
      }
      setShowServiceModal(false);
      setEditingService(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save service', 'error');
    }
  };

  const openEditService = (svc: Service) => {
    setEditingService(svc);
    setSvcName(svc.name);
    setSvcCode(svc.code);
    setSvcTime(String(svc.avg_handling_time_mins));
    setSvcColor(svc.color_theme);
    setShowServiceModal(true);
  };

  const openNewService = () => {
    setEditingService(null);
    setSvcName('');
    setSvcCode('');
    setSvcTime('10');
    setSvcColor('#3b82f6');
    setShowServiceModal(true);
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    try {
      await api.deleteService(id);
      showToast('Service deleted');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  // Analytics derived data
  const today = new Date().toISOString().split('T')[0];
  const todayTickets = tickets.filter(t => t.created_at.startsWith(today));
  const completed = tickets.filter(t => t.status === 'completed');
  const avgRating = 4.6;
  const avgWait = Math.max(2, Math.round(tickets.filter(t => t.status === 'waiting').length * 3.2));

  const hourlyData = Array.from({ length: 8 }, (_, i) => {
    const h = i + 8;
    return todayTickets.filter(t => new Date(t.created_at).getHours() === h).length;
  });

  // ── Login ──────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <button onClick={toggleTheme} className="nav-theme-btn" style={{ position: 'fixed', top: 16, right: 16, zIndex: 999 }}>
          {theme === 'dark' ? <Sun size={15} color="var(--text-muted)" /> : <Moon size={15} color="var(--text-muted)" />}
        </button>
        <div className="login-card anim-scale-in" style={{ maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, var(--purple), var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 8px 24px var(--purple-glow)' }}>
              <ShieldCheck size={26} color="#fff" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 4 }}>Admin Dashboard</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>System administration access</p>
          </div>
          {loginError && <div className="alert-error">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <div className="input-wrap">
                <span className="input-icon"><Mail size={15} /></span>
                <input className="form-input" type="email" placeholder="Admin Email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required />
              </div>
              <div className="input-wrap">
                <span className="input-icon"><Lock size={15} /></span>
                <input className="form-input" type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="submit-btn" disabled={loginLoading} style={{ background: 'linear-gradient(135deg, var(--purple), var(--primary))' }}>
              {loginLoading ? <span className="spinner" /> : '→'}&nbsp;{loginLoading ? 'Signing in...' : 'Access Admin Panel'}
            </button>
          </form>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button onClick={() => onNavigate('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-subtle)' }}>← Home</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Admin Layout ──────────────────────────────────────────
  return (
    <div className="admin-layout">

      {/* Toast */}
      {toast && (
        <div className="anim-slide-right" style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'success' ? 'var(--success)' : 'var(--danger)', color: '#fff', padding: '12px 20px', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 14, boxShadow: 'var(--shadow-lg)' }}>
          {toast.msg}
        </div>
      )}

      {/* Service modal */}
      {showServiceModal && (
        <div className="flow-overlay" onClick={e => { if (e.target === e.currentTarget) setShowServiceModal(false); }}>
          <div className="flow-sheet" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-heading)' }}>
                {editingService ? 'Edit Service' : 'New Service'}
              </h3>
              <button onClick={() => setShowServiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div className="input-group">
              <div className="input-wrap">
                <span className="input-icon" style={{ fontSize: 11, fontWeight: 700, left: 12 }}>Name</span>
                <input className="form-input" type="text" placeholder="Service Name" value={svcName} onChange={e => setSvcName(e.target.value)} style={{ paddingLeft: 58 }} />
              </div>
              <div className="input-wrap">
                <span className="input-icon" style={{ fontSize: 11, fontWeight: 700, left: 12 }}>Code</span>
                <input className="form-input" type="text" placeholder="e.g. REG, PAY, SUP" value={svcCode} onChange={e => setSvcCode(e.target.value.toUpperCase())} maxLength={5} style={{ paddingLeft: 58 }} />
              </div>
              <div className="input-wrap">
                <span className="input-icon" style={{ fontSize: 11, fontWeight: 700, left: 12 }}>Avg (min)</span>
                <input className="form-input" type="number" placeholder="Average handling minutes" value={svcTime} onChange={e => setSvcTime(e.target.value)} min={1} style={{ paddingLeft: 72 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Color</label>
                <input type="color" value={svcColor} onChange={e => setSvcColor(e.target.value)} style={{ width: 40, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer' }} />
                <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{svcColor}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowServiceModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSaveService} disabled={!svcName || !svcCode}>
                <Save size={14} /> {editingService ? 'Update' : 'Create'} Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className={`admin-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        <div className="admin-sidebar-logo">
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--purple), var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={16} color="#fff" />
          </div>
          {sidebarOpen && <span className="sidebar-brand">DQMS Admin</span>}
        </div>

        <nav className="sidebar-nav">
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.key}
              className={`sidebar-item ${section === item.key ? 'active' : ''}`}
              onClick={() => setSection(item.key)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
              title={!sidebarOpen ? item.label : undefined}
            >
              {item.icon}
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Sidebar bottom */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border-card)' }}>
          <button
            className="sidebar-item"
            onClick={() => { setLoggedIn(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', color: 'var(--danger)' }}
          >
            <LogOut size={16} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className={`admin-main ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>

        {/* Top bar */}
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <Menu size={20} />
            </button>
            <h1 className="page-title" style={{ fontSize: 18, margin: 0 }}>
              {SIDEBAR_ITEMS.find(i => i.key === section)?.label}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={loadData} className="btn btn-secondary btn-sm">
              <RefreshCw size={13} />
            </button>
            <button onClick={toggleTheme} className="nav-theme-btn">
              {theme === 'dark' ? <Sun size={14} color="var(--text-muted)" /> : <Moon size={14} color="var(--text-muted)" />}
            </button>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={16} color="var(--primary)" />
            </div>
          </div>
        </div>

        <div className="admin-content">

          {/* ── DASHBOARD ─────────────────────────────────── */}
          {section === 'dashboard' && (
            <div className="anim-fade-in-up">
              {/* KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { icon: <Users size={20} color="var(--primary)" />, value: MOCK_USERS.length, label: 'Total Users', trend: '+2 this week', up: true },
                  { icon: <CheckCircle2 size={20} color="var(--success)" />, value: todayTickets.length, label: 'Tickets Today', trend: `${completed.length} done`, up: true },
                  { icon: <Clock size={20} color="var(--warning)" />, value: `${avgWait}m`, label: 'Avg Wait', trend: 'Target: <10m', up: avgWait < 10 },
                  { icon: <Star size={20} color="#f59e0b" />, value: `${avgRating}★`, label: 'Customer Rating', trend: '94% positive', up: true },
                ].map(({ icon, value, label, trend, up }) => (
                  <div key={label} className="kpi-card">
                    {icon}
                    <div className="kpi-value">{value}</div>
                    <div className="kpi-label">{label}</div>
                    <div className={`kpi-trend ${up ? 'up' : 'down'}`}>{trend}</div>
                  </div>
                ))}
              </div>

              {/* Recent activity + quick actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                {/* Recent tickets */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-card)' }}>
                    <div className="card-title">Recent Tickets</div>
                    <span className="chip">{tickets.filter(t => t.status === 'waiting').length} waiting</span>
                  </div>
                  <table className="data-table" style={{ border: 'none' }}>
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Customer</th>
                        <th>Service</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.slice(0, 6).map(t => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{t.ticket_number}</td>
                          <td>{t.customer_name || 'Walk-in'}</td>
                          <td style={{ fontSize: 12 }}>{t.services?.name || '—'}</td>
                          <td><span className={`status-badge ${t.status === 'serving' ? 'active' : t.status === 'completed' ? 'online' : t.status === 'waiting' ? 'paused' : 'offline'}`}>{t.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Quick actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Manage Users', section: 'users' as AdminSection, color: 'var(--primary)', icon: <Users size={16} /> },
                    { label: 'Configure Services', section: 'services' as AdminSection, color: 'var(--success)', icon: <Layers size={16} /> },
                    { label: 'View Analytics', section: 'analytics' as AdminSection, color: 'var(--purple)', icon: <BarChart3 size={16} /> },
                    { label: 'Audit Logs', section: 'logs' as AdminSection, color: 'var(--warning)', icon: <FileText size={16} /> },
                    { label: 'System Settings', section: 'settings' as AdminSection, color: 'var(--secondary)', icon: <Settings size={16} /> },
                  ].map(({ label, section: sec, color, icon }) => (
                    <button
                      key={label}
                      className="card"
                      onClick={() => setSection(sec)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                        border: `1px solid var(--border-card)`, padding: '14px 16px',
                        background: 'none', width: '100%', textAlign: 'left', transition: 'var(--transition)',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-card)'; }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                        {icon}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-heading)' }}>{label}</span>
                      <ChevronRight size={14} color="var(--text-subtle)" style={{ marginLeft: 'auto' }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── USERS ─────────────────────────────────────── */}
          {section === 'users' && (
            <div className="anim-fade-in-up">
              <div className="page-title-row">
                <div>
                  <h2 className="page-title">User Management</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{MOCK_USERS.length} registered users</p>
                </div>
                <button className="btn btn-primary btn-sm"><Plus size={14} /> Add User</button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_USERS.map(user => (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{user.name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user.email}</td>
                      <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                      <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.lastLogin}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" title="Edit"><Edit3 size={12} /></button>
                          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Delete"><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── ROLES ─────────────────────────────────────── */}
          {section === 'roles' && (
            <div className="anim-fade-in-up">
              <div className="page-title-row">
                <div>
                  <h2 className="page-title">Role Permissions Matrix</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Access control for all system roles</p>
                </div>
              </div>
              <div className="permissions-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                <div className="perm-header-row" style={{ gridColumn: 'span 5', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-card)' }}>
                  {['Permission', 'Admin', 'Supervisor', 'Staff', 'Customer'].map(h => (
                    <div key={h} className="perm-cell" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, justifyContent: h === 'Permission' ? 'flex-start' : 'center' }}>
                      {h !== 'Permission' && <span className={`role-badge ${h.toLowerCase()}`}>{h}</span>}
                      {h === 'Permission' && h}
                    </div>
                  ))}
                </div>
                {PERMISSIONS.map(p => (
                  <div key={p.action} className="perm-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', borderBottom: '1px solid var(--border-card)' }}>
                    <div className="perm-cell" style={{ justifyContent: 'flex-start', fontSize: 13 }}>{p.action}</div>
                    {[p.admin, p.supervisor, p.staff, p.customer].map((v, i) => (
                      <div key={i} className="perm-cell">
                        <span className={v ? 'perm-check' : 'perm-cross'}>{v ? '✓' : '—'}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SERVICES ──────────────────────────────────── */}
          {section === 'services' && (
            <div className="anim-fade-in-up">
              <div className="page-title-row">
                <div>
                  <h2 className="page-title">Services</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{services.length} services configured</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={openNewService}><Plus size={14} /> New Service</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {services.map(svc => (
                  <div key={svc.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${svc.color_theme}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: svc.color_theme }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>{svc.name}</div>
                        <span className="chip" style={{ fontSize: 10, padding: '2px 8px' }}>{svc.code}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                      Avg handling: <strong style={{ color: 'var(--text-heading)' }}>{svc.avg_handling_time_mins} min</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEditService(svc)}>
                        <Edit3 size={12} /> Edit
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDeleteService(svc.id)}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── COUNTERS ──────────────────────────────────── */}
          {section === 'counters' && (
            <div className="anim-fade-in-up">
              <div className="page-title-row">
                <h2 className="page-title">Counter Management</h2>
                <button className="btn btn-primary btn-sm"><Plus size={14} /> Add Counter</button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Counter Name</th>
                    <th>Status</th>
                    <th>Current Service</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {counters.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.id}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{c.counter_name || `Counter ${c.id}`}</td>
                      <td><span className={`status-badge ${c.status}`}>{c.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {services.find(s => s.id === c.current_service_id)?.name || 'All Services'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm"><Edit3 size={12} /></button>
                          <button
                            className="btn btn-sm"
                            style={{ background: c.status === 'online' ? 'var(--danger)' : 'var(--success)', color: '#fff', border: 'none' }}
                            onClick={async () => {
                              await api.updateCounterStatus(c.id, c.status === 'online' ? 'offline' : 'online');
                              await loadData();
                              showToast(`Counter ${c.id} ${c.status === 'online' ? 'taken offline' : 'brought online'}`);
                            }}
                          >
                            {c.status === 'online' ? 'Offline' : 'Online'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── BRANCHES ──────────────────────────────────── */}
          {section === 'branches' && (
            <div className="anim-fade-in-up">
              <div className="page-title-row">
                <h2 className="page-title">Branch Management</h2>
                <button className="btn btn-primary btn-sm"><Plus size={14} /> Add Branch</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {BRANCHES.map(branch => (
                  <div key={branch.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 4 }}>{branch.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{branch.location}</div>
                      </div>
                      <span className={`status-badge ${branch.status === 'active' ? 'online' : 'paused'}`}>{branch.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16, marginTop: 8 }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)' }}>{branch.counters}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Counters</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}><Edit3 size={12} /> Edit</button>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}><Eye size={12} /> View</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ANALYTICS ─────────────────────────────────── */}
          {section === 'analytics' && (
            <div className="anim-fade-in-up">
              <h2 className="page-title" style={{ marginBottom: 20 }}>Analytics</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div className="chart-container">
                  <div className="card-header" style={{ marginBottom: 12 }}>
                    <div><div className="card-title">Peak Hours Today</div><div className="card-subtitle">Tickets per hour</div></div>
                  </div>
                  <MiniBar data={hourlyData} color="var(--primary)" />
                </div>
                <div className="chart-container">
                  <div className="card-header" style={{ marginBottom: 12 }}>
                    <div><div className="card-title">Service Distribution</div><div className="card-subtitle">Tickets by service today</div></div>
                  </div>
                  <MiniBar
                    data={services.map(s => todayTickets.filter(t => t.service_id === s.id).length)}
                    color="var(--success)"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Total Tickets (Today)', value: todayTickets.length, color: 'var(--primary)' },
                  { label: 'Completed', value: completed.length, color: 'var(--success)' },
                  { label: 'Active Counters', value: counters.filter(c => c.status === 'online').length, color: 'var(--secondary)' },
                  { label: 'Avg Wait (mins)', value: avgWait, color: 'var(--warning)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color, marginBottom: 4 }}>{value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── LOGS ──────────────────────────────────────── */}
          {section === 'logs' && (
            <div className="anim-fade-in-up">
              <h2 className="page-title" style={{ marginBottom: 20 }}>Audit Logs</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.slice(0, 10).map(t => (
                    <tr key={t.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleString()}</td>
                      <td style={{ fontSize: 13 }}>{t.customer_name || 'Customer'}</td>
                      <td style={{ fontSize: 13 }}>Joined Queue</td>
                      <td style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>{t.ticket_number}</td>
                      <td><span className={`status-badge ${t.status === 'completed' ? 'online' : t.status === 'cancelled' ? 'offline' : 'active'}`}>{t.status}</span></td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No logs yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── SETTINGS ──────────────────────────────────── */}
          {section === 'settings' && (
            <div className="anim-fade-in-up" style={{ maxWidth: 600 }}>
              <h2 className="page-title" style={{ marginBottom: 20 }}>System Settings</h2>
              {settingsSaved && <div className="alert-success" style={{ marginBottom: 16 }}>✓ Settings saved successfully!</div>}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Institution Info</div>
                <div className="input-group">
                  <div className="input-wrap">
                    <span className="input-icon" style={{ fontSize: 11, fontWeight: 700, left: 12 }}>Name</span>
                    <input className="form-input" type="text" value={settingInstName} onChange={e => setSettingInstName(e.target.value)} style={{ paddingLeft: 56 }} />
                  </div>
                </div>
              </div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Queue Configuration</div>
                <div className="input-group">
                  <div className="input-wrap">
                    <span className="input-icon" style={{ fontSize: 11, fontWeight: 700, left: 12 }}>Max</span>
                    <input className="form-input" type="number" value={settingMaxQueue} onChange={e => setSettingMaxQueue(e.target.value)} style={{ paddingLeft: 52 }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Maximum queue size per service</div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000); }}
              >
                <Save size={14} /> Save Settings
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
