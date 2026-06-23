import React, { useState, useEffect } from 'react';
import { api, getSupabaseClient } from '../../shared/services/api';
import type { Service, Ticket, Announcement } from '../../types';
import { useLang, useTheme } from '../../app/App';
import {
  Home, Ticket as TicketIcon, MapPin, Bell, User,
  Search, ArrowRight, ArrowLeft, CheckCircle,
  Phone, RefreshCw, Star,
  Sun, Moon, Globe, LogOut,
  ChevronRight, X,
  Volume2, VolumeX, Accessibility
} from 'lucide-react';

interface CustomerPortalProps {
  onNavigate: (view: string) => void;
}

type Tab = 'home' | 'ticket' | 'track' | 'notifications' | 'profile';
type FlowStep = 'select' | 'info' | 'review' | 'issued';

const SERVICE_ICONS: Record<string, string> = {
  REG: '🎓',
  PAY: '💰',
  SUP: '🛠️',
  EXE: '⭐',
  GEN: '📋',
  FIN: '💳',
  ICT: '💻',
  LIB: '📚',
  ADM: '🏛️',
  MED: '🏥',
};

function getGreeting(t: (k: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t('good_morning');
  if (h < 17) return t('good_afternoon');
  return t('good_evening');
}

// Simple SVG QR code placeholder
const QRCode: React.FC<{ value: string; size?: number }> = ({ value, size = 120 }) => {
  const seed = value.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells: boolean[][] = Array.from({ length: 15 }, (_, r) =>
    Array.from({ length: 15 }, (_, c) => {
      const v = (seed * (r + 1) * (c + 1)) % 17;
      return v > 7;
    })
  );
  const cellSize = size / 15;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="#fff" />
      {cells.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize} y={r * cellSize}
              width={cellSize} height={cellSize}
              fill="#000"
            />
          ) : null
        )
      )}
      {/* Corner markers */}
      {[[0, 0], [0, 10], [10, 0]].map(([rr, cc]) => (
        <g key={`${rr}-${cc}`}>
          <rect x={cc * cellSize} y={rr * cellSize} width={cellSize * 5} height={cellSize * 5} fill="#000" rx={1} />
          <rect x={cc * cellSize + cellSize} y={rr * cellSize + cellSize} width={cellSize * 3} height={cellSize * 3} fill="#fff" rx={0.5} />
          <rect x={cc * cellSize + cellSize * 1.5} y={rr * cellSize + cellSize * 1.5} width={cellSize * 2} height={cellSize * 2} fill="#000" rx={0.5} />
        </g>
      ))}
    </svg>
  );
};

// Toggle switch component
const Toggle: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
  <button className={`toggle-switch ${on ? 'on' : 'off'}`} onClick={onToggle} style={{ flexShrink: 0 }}>
    <span className="toggle-knob" />
  </button>
);

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ onNavigate }) => {
  const { t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useLang();

  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isGuest] = useState(() => localStorage.getItem('dqms_guest_mode') === 'true');
  const userName = isGuest ? 'Guest' : (localStorage.getItem('dqms_user_name') || 'there');

  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Queue flow
  const [showFlow, setShowFlow] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('select');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active ticket
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [waitStats, setWaitStats] = useState({ peopleAhead: 0, waitMins: 0 });

  // Notifications
  const [notifications, setNotifications] = useState<Announcement[]>([]);

  // Profile settings
  const [highContrast, setHighContrast] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Search
  const [search, setSearch] = useState('');

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        const [svcs, anns] = await Promise.all([
          api.getServices(),
          api.getAnnouncements(),
        ]);
        setServices(svcs);
        setNotifications(anns.filter(a => a.active).slice(0, 10));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingServices(false);
      }
    };
    load();
  }, []);

  // High contrast
  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', highContrast ? 'high' : '');
  }, [highContrast]);

  // Real-time polling for ticket status
  useEffect(() => {
    if (!myTicket) return;
    const interval = setInterval(async () => {
      try {
        const tickets = await api.getTickets();
        const updated = tickets.find(t => t.id === myTicket.id);
        if (updated) {
          setMyTicket(updated);
          // Voice alert when serving
          if (updated.status === 'serving' && voiceEnabled) {
            const utterance = new SpeechSynthesisUtterance(
              `Ticket number ${updated.ticket_number}. Please proceed to counter ${updated.counter_assigned}.`
            );
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
          }
        }
      } catch { /* ignore */ }
    }, 8000);
    return () => clearInterval(interval);
  }, [myTicket, voiceEnabled]);

  const filteredServices = services.filter(s =>
    search === '' ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  // Submit queue join
  const handleJoinQueue = async () => {
    if (!selectedService) return;
    setSubmitting(true);
    try {
      const result = await api.createTicket(
        selectedService.id,
        isGuest ? (customerName || 'Guest') : customerName,
        customerPhone,
        'normal'
      );
      setMyTicket(result.ticket);
      setWaitStats({ peopleAhead: result.people_ahead, waitMins: result.wait_time_mins });
      setFlowStep('issued');
      setActiveTab('ticket');
    } catch (err: any) {
      alert(err.message || 'Failed to join queue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    const supabase = getSupabaseClient();
    if (supabase) supabase.auth.signOut();
    localStorage.removeItem('dqms_guest_mode');
    localStorage.removeItem('user_role');
    onNavigate('welcome');
  };

  const ticketStatus = myTicket?.status ?? 'waiting';
  const trackSteps = [
    { key: 'issued', label: t('ticket_issued'), desc: 'Your ticket has been generated', icon: '🎫' },
    { key: 'waiting', label: t('waiting'), desc: `${waitStats.peopleAhead} people ahead of you`, icon: '⏳' },
    { key: 'almost', label: t('almost_ready'), desc: 'You are next in line!', icon: '📢' },
    { key: 'serving', label: t('now_serving'), desc: `Counter ${myTicket?.counter_assigned ?? '–'} is ready`, icon: '✅' },
    { key: 'completed', label: t('completed'), desc: 'Service complete. Thank you!', icon: '🎉' },
  ];

  const currentStepIndex = !myTicket ? -1 :
    ticketStatus === 'completed' ? 4 :
    ticketStatus === 'serving' ? 3 :
    waitStats.peopleAhead <= 1 ? 2 :
    ticketStatus === 'waiting' ? 1 : 0;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'home', label: t('home'), icon: <Home size={20} /> },
    { key: 'ticket', label: t('ticket'), icon: <TicketIcon size={20} /> },
    { key: 'track', label: t('track'), icon: <MapPin size={20} /> },
    { key: 'notifications', label: t('notifications'), icon: <Bell size={20} /> },
    { key: 'profile', label: t('profile'), icon: <User size={20} /> },
  ];

  return (
    <div className="customer-page">

      {/* ── Bottom Navigation ──────────────────────────────── */}
      <nav className="customer-bottom-nav">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`cust-nav-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span className="cust-nav-icon">{tab.icon}</span>
            <span className="cust-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ══════════════════════════════════════════════
          HOME TAB
         ══════════════════════════════════════════════ */}
      {activeTab === 'home' && (
        <div className="anim-fade-in-up">
          {/* Header */}
          <div className="customer-header">
            <div>
              <div className="customer-greeting">{getGreeting(t)}, {userName} 👋</div>
              <div className="customer-subgreeting">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isGuest && <span className="guest-badge">👤 {t('guest_mode')}</span>}
            </div>
          </div>

          {/* Big Join Queue Button */}
          <button
            className="join-queue-btn"
            onClick={() => { setFlowStep('select'); setShowFlow(true); }}
          >
            🎫 {t('join_queue')}
            <ArrowRight size={20} />
          </button>

          {/* Services section */}
          <div className="services-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>{t('services')}</h3>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('search_services')}
                  style={{
                    background: 'var(--bg-input)', border: '1px solid var(--border-input)',
                    borderRadius: 'var(--radius-sm)', padding: '6px 10px 6px 28px',
                    fontSize: 12, color: 'var(--color-input)', width: 140,
                  }}
                />
              </div>
            </div>
            <div className="services-scroll">
              {loadingServices ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ width: 80, height: 80, background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-card)', animation: 'shimmer 1.5s infinite' }} />
                  ))}
                </div>
              ) : filteredServices.map(svc => (
                <button
                  key={svc.id}
                  className="service-chip"
                  onClick={() => {
                    setSelectedService(svc);
                    setFlowStep('info');
                    setShowFlow(true);
                  }}
                  style={{ background: 'none', cursor: 'pointer' }}
                >
                  <div className="service-chip-icon" style={{ background: `${svc.color_theme}18`, color: svc.color_theme }}>
                    {SERVICE_ICONS[svc.code] || '📋'}
                  </div>
                  <span className="service-chip-name">{svc.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active ticket mini card */}
          {myTicket && myTicket.status !== 'completed' && (
            <div style={{ padding: '0 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('your_ticket')}
              </div>
              <div
                className="ticket-card-premium"
                onClick={() => setActiveTab('ticket')}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, marginBottom: 4 }}>
                      {myTicket.services?.name || t('service')}
                    </div>
                    <div className="ticket-number">{myTicket.ticket_number}</div>
                  </div>
                  <span className={`ticket-status-badge ${ticketStatus}`} style={{
                    background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)'
                  }}>
                    {ticketStatus === 'serving' ? '🟢 ' + t('now_serving') : '⏳ ' + t('waiting')}
                  </span>
                </div>
                <div className="ticket-stats-row">
                  <div className="ticket-stat">
                    <span className="ticket-stat-value">{waitStats.peopleAhead}</span>
                    <span className="ticket-stat-label">{t('people_ahead')}</span>
                  </div>
                  <div className="ticket-stat">
                    <span className="ticket-stat-value">{waitStats.waitMins}</span>
                    <span className="ticket-stat-label">{t('mins')}</span>
                  </div>
                  <div className="ticket-stat">
                    <span className="ticket-stat-value">{myTicket.counter_assigned ?? '–'}</span>
                    <span className="ticket-stat-label">{t('counter')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No ticket state */}
          {!myTicket && (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎫</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 6 }}>{t('no_active_ticket')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('join_a_queue')}</div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TICKET TAB
         ══════════════════════════════════════════════ */}
      {activeTab === 'ticket' && (
        <div className="anim-fade-in-up" style={{ padding: '20px 0' }}>
          <div style={{ padding: '0 16px', marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.5px' }}>
              {t('your_ticket')}
            </h2>
          </div>

          {myTicket ? (
            <>
              {/* Premium ticket card */}
              <div className="ticket-card-premium">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 600 }}>
                    {myTicket.services?.name || t('service')}
                  </div>
                  <span style={{
                    background: 'rgba(255,255,255,0.2)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: 11, fontWeight: 700, padding: '4px 10px',
                    borderRadius: 'var(--radius-full)'
                  }}>
                    {ticketStatus === 'serving' ? '🟢 NOW SERVING' : ticketStatus === 'completed' ? '✅ DONE' : '⏳ WAITING'}
                  </span>
                </div>
                <div className="ticket-number">{myTicket.ticket_number}</div>
                <div className="ticket-service">{myTicket.customer_name}</div>
                <div className="ticket-stats-row">
                  <div className="ticket-stat">
                    <span className="ticket-stat-value">{waitStats.peopleAhead}</span>
                    <span className="ticket-stat-label">{t('people_ahead')}</span>
                  </div>
                  <div className="ticket-stat">
                    <span className="ticket-stat-value">{waitStats.waitMins} {t('mins')}</span>
                    <span className="ticket-stat-label">{t('estimated_wait')}</span>
                  </div>
                  <div className="ticket-stat">
                    <span className="ticket-stat-value">{myTicket.counter_assigned ?? '–'}</span>
                    <span className="ticket-stat-label">{t('counter')}</span>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              <div style={{ padding: '20px 16px' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Scan for Verification
                  </div>
                  <div className="qr-container" style={{ margin: '0 auto', display: 'inline-flex' }}>
                    <QRCode value={myTicket.id} size={140} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 12 }}>
                    Ticket ID: {myTicket.ticket_number}
                  </div>
                </div>
              </div>

              {/* Cancel ticket */}
              {ticketStatus === 'waiting' && (
                <div style={{ padding: '0 16px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={async () => {
                      if (!confirm('Cancel your ticket?')) return;
                      await api.updateTicketStatus(myTicket.id, 'cancelled');
                      setMyTicket(null);
                      setActiveTab('home');
                    }}
                  >
                    <X size={15} />
                    Cancel Ticket
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎫</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 8 }}>{t('no_active_ticket')}</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>{t('join_a_queue')}</div>
              <button
                className="btn btn-primary"
                onClick={() => { setFlowStep('select'); setShowFlow(true); }}
              >
                <TicketIcon size={16} /> {t('join_queue')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TRACK TAB
         ══════════════════════════════════════════════ */}
      {activeTab === 'track' && (
        <div className="anim-fade-in-up">
          <div style={{ padding: '20px 16px 0' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.5px', marginBottom: 4 }}>
              Track Queue
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
              {myTicket ? `Ticket ${myTicket.ticket_number} — Live Updates` : 'Join a queue to start tracking'}
            </p>
          </div>

          {myTicket ? (
            <div className="track-timeline">
              {/* Progress bar */}
              <div style={{ margin: '0 0 32px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-card)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                    Step {currentStepIndex + 1} of {trackSteps.length}
                  </span>
                </div>
                <div style={{ background: 'var(--border-card)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${((currentStepIndex + 1) / trackSteps.length) * 100}%`,
                    background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>

              <div className="timeline-track">
                {trackSteps.map((step, i) => {
                  const isDone = i < currentStepIndex;
                  const isActive = i === currentStepIndex;
                  return (
                    <div key={step.key} className={`timeline-step ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                      <div className="timeline-dot">
                        {isDone ? <CheckCircle size={14} /> : isActive ? <span style={{ fontSize: 14 }}>{step.icon}</span> : null}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-label">{step.label}</div>
                        <div className="timeline-desc">{step.desc}</div>
                        {isActive && (
                          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                            <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>
                              {waitStats.peopleAhead} {t('people_ahead')}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                              ~{waitStats.waitMins} {t('mins')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Refresh */}
              <button
                className="btn btn-secondary"
                style={{ margin: '16px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={async () => {
                  const tickets = await api.getTickets();
                  const updated = tickets.find(t => t.id === myTicket.id);
                  if (updated) {
                    setMyTicket(updated);
                    setWaitStats(prev => ({ ...prev, peopleAhead: Math.max(0, prev.peopleAhead - 1) }));
                  }
                }}
              >
                <RefreshCw size={14} />
                Refresh Status
              </button>
            </div>
          ) : (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 8 }}>No Queue Active</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>Join a queue to track your progress in real time</div>
              <button className="btn btn-primary" onClick={() => { setActiveTab('home'); }}>
                <Home size={16} /> Go to Home
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          NOTIFICATIONS TAB
         ══════════════════════════════════════════════ */}
      {activeTab === 'notifications' && (
        <div className="anim-fade-in-up">
          <div style={{ padding: '20px 16px 16px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.5px', marginBottom: 4 }}>
              {t('notifications')}
            </h2>
          </div>

          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Queue status notification if active */}
            {myTicket && myTicket.status !== 'completed' && (
              <div className="notif-card" style={{ borderColor: 'var(--primary)', background: 'var(--primary-subtle)' }}>
                <div className="notif-icon" style={{ background: 'var(--primary)', color: '#fff' }}>
                  <TicketIcon size={18} />
                </div>
                <div>
                  <div className="notif-title">Queue Update — {myTicket.ticket_number}</div>
                  <div className="notif-body">
                    {myTicket.status === 'serving'
                      ? `Counter ${myTicket.counter_assigned} is ready for you!`
                      : `You are in queue. ${waitStats.peopleAhead} people ahead.`}
                  </div>
                  <div className="notif-time">Just now</div>
                </div>
              </div>
            )}

            {notifications.map((ann) => (
              <div key={ann.id} className="notif-card">
                <div className="notif-icon" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
                  <Bell size={18} />
                </div>
                <div>
                  <div className="notif-title">Announcement</div>
                  <div className="notif-body">{ann.message}</div>
                  <div className="notif-time">{new Date(ann.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}

            {notifications.length === 0 && !myTicket && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-heading)' }}>{t('no_notifications')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>You'll be notified when your ticket is called</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          PROFILE TAB
         ══════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div className="anim-fade-in-up">
          <div style={{ padding: '20px 16px 16px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.5px', marginBottom: 4 }}>
              {t('profile')}
            </h2>
          </div>

          {/* Guest CTA */}
          {isGuest && (
            <div style={{
              margin: '0 16px 20px',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              borderRadius: 'var(--radius)',
              padding: '20px',
              color: '#fff',
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Save Your Progress</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 16, lineHeight: 1.5 }}>
                Create a free account to access ticket history, notifications, and faster queue joining.
              </div>
              <button
                className="btn"
                onClick={() => onNavigate('login')}
                style={{ background: '#fff', color: 'var(--primary)', fontWeight: 800 }}
              >
                {t('create_account')} →
              </button>
            </div>
          )}

          {/* Settings list */}
          <div style={{ padding: '0 16px' }}>
            <div className="card">
              {/* Theme */}
              <div className="settings-row">
                <div className="settings-label">
                  <div className="settings-icon">
                    {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                  </div>
                  <div>
                    <div className="settings-text">{t('theme')}</div>
                    <div className="settings-sub">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
                  </div>
                </div>
                <Toggle on={theme === 'dark'} onToggle={toggleTheme} />
              </div>

              {/* Language */}
              <div className="settings-row">
                <div className="settings-label">
                  <div className="settings-icon"><Globe size={16} /></div>
                  <div>
                    <div className="settings-text">{t('language')}</div>
                    <div className="settings-sub">{lang === 'en' ? 'English' : 'Kiswahili'}</div>
                  </div>
                </div>
                <button
                  onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
                  className="chip"
                  style={{ background: 'none', border: '1px solid var(--border-card-hover)', cursor: 'pointer' }}
                >
                  {lang === 'en' ? '🇬🇧 EN' : '🇹🇿 SW'}
                </button>
              </div>

              {/* Voice */}
              <div className="settings-row">
                <div className="settings-label">
                  <div className="settings-icon">{voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</div>
                  <div>
                    <div className="settings-text">Voice Alerts</div>
                    <div className="settings-sub">Announce when your ticket is called</div>
                  </div>
                </div>
                <Toggle on={voiceEnabled} onToggle={() => setVoiceEnabled(!voiceEnabled)} />
              </div>

              {/* High contrast */}
              <div className="settings-row">
                <div className="settings-label">
                  <div className="settings-icon"><Accessibility size={16} /></div>
                  <div>
                    <div className="settings-text">{t('accessibility')}</div>
                    <div className="settings-sub">High Contrast Mode</div>
                  </div>
                </div>
                <Toggle on={highContrast} onToggle={() => setHighContrast(!highContrast)} />
              </div>
            </div>

            {/* Feedback */}
            {myTicket && myTicket.status === 'completed' && !feedbackSubmitted && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">Rate Your Experience</div>
                    <div className="card-subtitle">How was your service today?</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      onClick={() => setFeedbackRating(star)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 28, transition: 'transform 0.2s',
                        filter: star <= feedbackRating ? 'none' : 'grayscale(1) opacity(0.4)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = '')}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackComment}
                  onChange={e => setFeedbackComment(e.target.value)}
                  placeholder="Any comments? (optional)"
                  rows={3}
                  style={{
                    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-input)',
                    borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--color-input)',
                    fontSize: 13, resize: 'none', marginBottom: 12,
                  }}
                />
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={async () => {
                    try {
                      await api.submitFeedback(myTicket.ticket_number, feedbackRating, feedbackComment);
                      setFeedbackSubmitted(true);
                    } catch { setFeedbackSubmitted(true); }
                  }}
                >
                  <Star size={15} /> Submit Feedback
                </button>
              </div>
            )}
            {feedbackSubmitted && <div className="alert-success" style={{ marginTop: 16 }}>✓ Thank you for your feedback!</div>}

            {/* Logout */}
            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16, color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={handleLogout}
            >
              <LogOut size={15} />
              {t('logout')}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          QUEUE FLOW MODAL
         ══════════════════════════════════════════════ */}
      {showFlow && (
        <div className="flow-overlay" onClick={e => { if (e.target === e.currentTarget) setShowFlow(false); }}>
          <div className="flow-sheet">
            {/* Step indicators */}
            <div className="step-dots">
              {(['select', 'info', 'review', 'issued'] as FlowStep[]).map((s, i) => {
                const stepIdx = ['select', 'info', 'review', 'issued'].indexOf(flowStep);
                return (
                  <div key={s} className={`step-dot ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`} />
                );
              })}
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-heading)' }}>
                  {flowStep === 'select' ? t('select_service') :
                   flowStep === 'info' ? t('enter_your_info') :
                   flowStep === 'review' ? t('review_confirm') :
                   '🎉 ' + t('your_ticket')}
                </h3>
              </div>
              <button
                onClick={() => setShowFlow(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Step 1: Select Service */}
            {flowStep === 'select' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
                  {services.map(svc => (
                    <button
                      key={svc.id}
                      onClick={() => { setSelectedService(svc); setFlowStep('info'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: selectedService?.id === svc.id ? 'var(--primary-subtle)' : 'var(--bg-app)',
                        border: `1.5px solid ${selectedService?.id === svc.id ? 'var(--primary)' : 'var(--border-card)'}`,
                        borderRadius: 'var(--radius)', padding: '14px 16px',
                        cursor: 'pointer', transition: 'var(--transition)', textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${svc.color_theme}18`, color: svc.color_theme, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {SERVICE_ICONS[svc.code] || '📋'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>{svc.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>~{svc.avg_handling_time_mins} min avg</div>
                      </div>
                      <ChevronRight size={16} color="var(--text-subtle)" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Enter Info */}
            {flowStep === 'info' && (
              <div>
                {selectedService && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: 14, background: 'var(--primary-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-card-hover)' }}>
                    <div style={{ fontSize: 22 }}>{SERVICE_ICONS[selectedService.code] || '📋'}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{selectedService.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>~{selectedService.avg_handling_time_mins} min</div>
                    </div>
                  </div>
                )}

                <div className="input-group">
                  <div className="input-wrap">
                    <span className="input-icon"><User size={15} /></span>
                    <input
                      className="form-input"
                      type="text"
                      placeholder={isGuest ? `${t('full_name')} (optional)` : t('full_name')}
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="input-wrap">
                    <span className="input-icon"><Phone size={15} /></span>
                    <input
                      className="form-input"
                      type="tel"
                      placeholder={t('phone_number')}
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      required={!isGuest}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setFlowStep('select')}>
                    <ArrowLeft size={14} /> {t('back')}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 2, justifyContent: 'center' }}
                    onClick={() => setFlowStep('review')}
                    disabled={!isGuest && !customerPhone}
                  >
                    {t('next')} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {flowStep === 'review' && (
              <div>
                <div style={{ background: 'var(--bg-app)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: t('service'), value: selectedService?.name ?? '–' },
                      { label: t('name'), value: customerName || (isGuest ? 'Guest' : '–') },
                      { label: t('phone_number'), value: customerPhone || (isGuest ? 'Not provided' : '–') },
                      { label: 'Priority', value: 'Standard' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setFlowStep('info')}>
                    <ArrowLeft size={14} /> {t('back')}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 2, justifyContent: 'center' }}
                    onClick={handleJoinQueue}
                    disabled={submitting}
                  >
                    {submitting ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Joining...</> : <><TicketIcon size={15} /> {t('confirm')}</>}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Issued */}
            {flowStep === 'issued' && myTicket && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 4 }}>You're in the queue!</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Your digital ticket has been issued</div>

                <div style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  borderRadius: 'var(--radius)', padding: '24px', color: '#fff', marginBottom: 24
                }}>
                  <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600, marginBottom: 4 }}>YOUR TICKET</div>
                  <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>{myTicket.ticket_number}</div>
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>{myTicket.services?.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16, gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{waitStats.peopleAhead}</div>
                      <div style={{ fontSize: 10, opacity: 0.8 }}>{t('people_ahead')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{waitStats.waitMins}</div>
                      <div style={{ fontSize: 10, opacity: 0.8 }}>{t('mins')}</div>
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
                  onClick={() => { setShowFlow(false); setActiveTab('track'); }}
                >
                  <MapPin size={15} /> Track My Queue
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setShowFlow(false)}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
