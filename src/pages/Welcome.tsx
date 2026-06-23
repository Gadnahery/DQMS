import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useTheme, useLang } from '../App';
import {
  QrCode, Brain, Radio, Mic, Building2,
  ArrowRight, ChevronRight, Sun, Moon,
  Users, Clock, Layers,
  Ticket, CheckCircle
} from 'lucide-react';

interface WelcomeProps {
  onNavigate: (view: string) => void;
}

const FEATURES = [
  {
    icon: QrCode,
    title: 'QR Queue Entry',
    desc: 'Scan & join any queue instantly — no app download required.',
    color: '#2563eb',
  },
  {
    icon: Brain,
    title: 'AI Wait Prediction',
    desc: 'Machine learning estimates your wait time to the minute.',
    color: '#7c3aed',
  },
  {
    icon: Radio,
    title: 'Real-Time Tracking',
    desc: 'Watch your position update live — like tracking a package.',
    color: '#0891b2',
  },
  {
    icon: Mic,
    title: 'Voice Calling',
    desc: 'Audible announcements when your ticket number is called.',
    color: '#059669',
  },
  {
    icon: Building2,
    title: 'Multi-Branch',
    desc: 'One platform for all locations — universities, hospitals, banks.',
    color: '#d97706',
  },
];

const HOW_STEPS = [
  {
    num: '1',
    emoji: '🏛️',
    title: 'Select Service',
    desc: 'Choose from available services at your institution — registration, payments, support, and more.',
  },
  {
    num: '2',
    emoji: '🎫',
    title: 'Get Ticket',
    desc: 'Receive a digital ticket with your position, estimated wait time, and a QR code for verification.',
  },
  {
    num: '3',
    emoji: '📍',
    title: 'Track Queue',
    desc: 'Leave the waiting area. Monitor your queue position in real time and get notified when it\'s your turn.',
  },
];

const FOOTER_LINKS = ['About', 'Contact', 'Privacy', 'Terms', 'Support'];
const PORTAL_LINKS = [
  { label: 'Staff Portal', hash: 'staff' },
  { label: 'Supervisor', hash: 'supervisor' },
  { label: 'Admin Dashboard', hash: 'admin' },
  { label: 'Display Board', hash: 'display' },
];

// Animated counter hook
function useAnimatedCount(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  return { count, ref };
}

export const Welcome: React.FC<WelcomeProps> = ({ onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [liveStats, setLiveStats] = useState({
    served: 0, queues: 0, avgWait: 0, counters: 0
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [tickets, counters] = await Promise.all([
          api.getTickets(),
          api.getCounters(),
        ]);
        const today = new Date().toISOString().split('T')[0];
        const todayTickets = tickets.filter(t => t.created_at.startsWith(today));
        const served = todayTickets.filter(t => t.status === 'completed').length;
        const waiting = tickets.filter(t => t.status === 'waiting');
        const activeCounters = counters.filter(c => c.status === 'online').length;
        const avgWait = Math.round(waiting.length * 3.5);
        setLiveStats({ served, queues: waiting.length, avgWait, counters: activeCounters });
      } catch {
        setLiveStats({ served: 2847, queues: 12, avgWait: 8, counters: 6 });
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { icon: CheckCircle, value: liveStats.served, suffix: '+', label: 'Customers Served Today', color: 'var(--success)' },
    { icon: Users, value: liveStats.queues, suffix: '', label: 'Active Queues', color: 'var(--primary)' },
    { icon: Clock, value: liveStats.avgWait, suffix: ' min', label: 'Average Wait Time', color: 'var(--warning)' },
    { icon: Layers, value: liveStats.counters, suffix: '', label: 'Service Counters', color: 'var(--purple)' },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav
        className="landing-nav"
        style={{
          boxShadow: scrolled ? 'var(--shadow-md)' : 'none',
          borderBottomColor: scrolled ? 'var(--border-card)' : 'transparent',
        }}
      >
        <div className="landing-logo">
          <div className="landing-logo-icon">
            <Ticket size={18} color="#fff" />
          </div>
          <span>DQMS</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>2.0</span>
        </div>

        <div className="landing-nav-actions">
          <button
            className="nav-lang-btn"
            onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
          >
            {lang === 'en' ? '🇬🇧 EN' : '🇹🇿 SW'}
          </button>
          <button className="nav-theme-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={15} color="var(--text-muted)" /> : <Moon size={15} color="var(--text-muted)" />}
          </button>
          <button className="nav-btn-outline hide-mobile" onClick={() => onNavigate('login')}>Login</button>
          <button className="nav-btn-primary" onClick={() => onNavigate('login')}>
            Join Queue
          </button>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────── */}
      <section className="hero-section" style={{ background: 'var(--bg-gradient)' }}>
        {/* Background orbs */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: theme === 'dark' ? 0.6 : 0.3 }}
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 1400 900"
        >
          <defs>
            <radialGradient id="og1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="og2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="og3" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--purple)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--purple)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="300" r="400" fill="url(#og1)" style={{ animation: 'float 7s ease-in-out infinite' }} />
          <circle cx="1200" cy="600" r="350" fill="url(#og2)" style={{ animation: 'float 9s ease-in-out infinite', animationDelay: '-3s' }} />
          <circle cx="1100" cy="100" r="280" fill="url(#og3)" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '-5s' }} />
        </svg>

        <div className="hero-content" style={{ position: 'relative', zIndex: 1 }}>
          {/* Left text content */}
          <div>
            <div className="hero-badge anim-fade-in-up delay-1">
              <span className="hero-badge-dot" />
              Smart Queue Management System
            </div>

            <h1 className="hero-h1 anim-fade-in-up delay-2">
              Smart Queue Management<br />
              <span className="gradient-text">Without Waiting in Line</span>
            </h1>

            <p className="hero-subtitle anim-fade-in-up delay-3">
              Join queues remotely.<br />
              Track progress in real time.<br />
              Get notified when it's your turn.
            </p>

            <div className="hero-ctas anim-fade-in-up delay-4">
              <button
                className="btn-hero-primary"
                onClick={() => onNavigate('login')}
              >
                <Ticket size={18} />
                Join Queue
                <ArrowRight size={16} />
              </button>
              <button
                className="btn-hero-outline"
                onClick={() => onNavigate('login')}
              >
                Login
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Trust row */}
            <div className="anim-fade-in-up delay-5" style={{ marginTop: 36, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { icon: '🏛️', label: 'Universities' },
                { icon: '🏥', label: 'Hospitals' },
                { icon: '🏦', label: 'Banks' },
                { icon: '🏛️', label: 'Government' },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Phone mockup */}
          <div className="hero-visual anim-fade-in delay-3">
            <div className="phone-mockup">
              <div className="phone-screen">
                {/* Fake phone UI */}
                <div style={{ padding: '16px 12px 8px', background: 'var(--bg-card)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Good Morning 👋</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.5px' }}>John</div>
                </div>

                <div style={{ padding: '12px', flex: 1 }}>
                  {/* Join queue button mockup */}
                  <div style={{
                    background: 'var(--primary)', color: '#fff', borderRadius: 14,
                    padding: '14px', textAlign: 'center', marginBottom: 12,
                    fontSize: 14, fontWeight: 800
                  }}>
                    🎫 Join Queue
                  </div>

                  {/* Service chips mockup */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Services</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {['🎓 Admissions', '💰 Finance', '💻 ICT', '📚 Library'].map(s => (
                      <div key={s} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-card)',
                        borderRadius: 10, padding: '10px 8px', fontSize: 10, fontWeight: 700,
                        color: 'var(--text-heading)', textAlign: 'center'
                      }}>
                        {s}
                      </div>
                    ))}
                  </div>

                  {/* Active ticket mini */}
                  <div style={{
                    marginTop: 12, background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    borderRadius: 12, padding: '12px', color: '#fff'
                  }}>
                    <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 600 }}>ACTIVE TICKET</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -1 }}>A102</div>
                      <div style={{ fontSize: 10, textAlign: 'right' }}>
                        <div style={{ fontWeight: 700 }}>3 ahead</div>
                        <div style={{ opacity: 0.8 }}>~8 min</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom nav mockup */}
                <div style={{
                  display: 'flex', justifyContent: 'space-around', padding: '10px 0 14px',
                  background: 'var(--bg-nav)', borderTop: '1px solid var(--border-card)'
                }}>
                  {['🏠', '🎫', '📍', '🔔', '👤'].map((icon, i) => (
                    <div key={i} style={{
                      fontSize: i === 0 ? 18 : 15,
                      opacity: i === 0 ? 1 : 0.5,
                    }}>{icon}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating notification card */}
            <div style={{
              position: 'absolute', right: -30, top: '30%',
              background: 'var(--bg-card)', border: '1px solid var(--border-card)',
              borderRadius: 14, padding: '12px 16px', boxShadow: 'var(--shadow-lg)',
              fontSize: 12, minWidth: 160, animation: 'float 4s ease-in-out infinite',
              animationDelay: '-2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: 11 }}>Your Turn!</span>
              </div>
              <div style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Counter 3 is<br />ready for you
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Statistics ─────────────────────────────────── */}
      <section className="stats-section">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="section-eyebrow">Live Data</div>
            <h2 className="section-title">Real-Time System Statistics</h2>
          </div>
          <div className="stats-grid">
            {statCards.map(({ icon: Icon, value, suffix, label, color }) => (
              <StatCountCard key={label} icon={<Icon size={22} color={color} />} value={value} suffix={suffix} label={label} color={color} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────── */}
      <section style={{ padding: 'var(--space-12) clamp(16px, 5vw, 64px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="section-eyebrow anim-fade-in-up">How It Works</div>
          <h2 className="section-title anim-fade-in-up delay-1">3 Simple Steps</h2>
          <p className="section-subtitle anim-fade-in-up delay-2">
            No training needed. No complicated forms. Just pick a service and let DQMS handle the rest.
          </p>

          <div className="how-steps">
            {HOW_STEPS.map((step, i) => (
              <div key={step.num} className={`how-step anim-fade-in-up delay-${i + 2}`}>
                <div className="how-step-number">{step.num}</div>
                <div className="how-step-icon">{step.emoji}</div>
                <div className="how-step-title">{step.title}</div>
                <div className="how-step-desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="features-section">
        <div className="features-inner">
          <div style={{ marginBottom: 40, textAlign: 'center' }}>
            <div className="section-eyebrow">Platform Features</div>
            <h2 className="section-title">Everything You Need</h2>
          </div>
          <div className="features-grid">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="feature-card anim-fade-in-up">
                <div className="feature-icon" style={{ background: `${color}18`, color }}>
                  <Icon size={22} />
                </div>
                <div className="feature-title">{title}</div>
                <div className="feature-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────── */}
      <section style={{
        padding: 'var(--space-12) clamp(16px, 5vw, 64px)',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
        textAlign: 'center',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.12) 0%, transparent 60%), radial-gradient(circle at 70% 50%, rgba(255,255,255,0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 900, marginBottom: 16, letterSpacing: '-0.04em', color: '#fff' }}>
            Ready to eliminate waiting?
          </h2>
          <p style={{ fontSize: 17, opacity: 0.9, marginBottom: 32, maxWidth: 480, margin: '0 auto 32px' }}>
            Join thousands of institutions already using DQMS to deliver faster, smarter service.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => onNavigate('login')}
              style={{
                background: '#fff', color: 'var(--primary)',
                border: 'none', borderRadius: 'var(--radius)',
                padding: '14px 32px', fontSize: 15, fontWeight: 800,
                cursor: 'pointer', transition: 'var(--transition-spring)',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = '')}
            >
              <Ticket size={18} />
              Join Queue Now
            </button>
            <button
              onClick={() => onNavigate('login')}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: '1.5px solid rgba(255,255,255,0.4)',
                borderRadius: 'var(--radius)',
                padding: '14px 32px', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', transition: 'var(--transition)',
                backdropFilter: 'blur(10px)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            >
              Login
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-top">
            {/* Brand */}
            <div>
              <div className="landing-logo" style={{ marginBottom: 12 }}>
                <div className="landing-logo-icon">
                  <Ticket size={16} color="#fff" />
                </div>
                <span>DQMS</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>2.0</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.6 }}>
                Smart Digital Queue Management for universities, hospitals, banks, and government offices.
              </p>
            </div>

            {/* Main links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Links</div>
              {FOOTER_LINKS.map(link => (
                <span key={link} className="footer-link">{link}</span>
              ))}
            </div>

            {/* Portal links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Portals</div>
              {PORTAL_LINKS.map(({ label, hash }) => (
                <button
                  key={hash}
                  onClick={() => onNavigate(hash)}
                  className="footer-portal-link"
                  style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="footer-divider" />

          <div className="footer-bottom">
            <span className="footer-copy">© 2025 DQMS — Smart Queue Management System. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                className="nav-lang-btn"
                onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
              >
                {lang === 'en' ? '🇬🇧 EN' : '🇹🇿 SW'}
              </button>
              <button className="nav-theme-btn" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={14} color="var(--text-muted)" /> : <Moon size={14} color="var(--text-muted)" />}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* ── Animated stat counter card ─────────────────────────────── */
const StatCountCard: React.FC<{
  icon: React.ReactNode;
  value: number;
  suffix: string;
  label: string;
  color: string;
}> = ({ icon, value, suffix, label, color }) => {
  const { count, ref } = useAnimatedCount(value);
  return (
    <div ref={ref} className="stat-card">
      <div style={{ marginBottom: 8, color }}>{icon}</div>
      <div className="stat-value" style={{ color }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
};


