import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import type { Ticket, Announcement } from '../api';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';

interface DisplayBoardProps {
  onNavigate: (view: string) => void;
}

// SVG QR code for scanning
const QRSmall: React.FC = () => (
  <svg width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#000" />
    {/* Corner markers */}
    <rect x="4" y="4" width="24" height="24" fill="#fff" rx={1} />
    <rect x="8" y="8" width="16" height="16" fill="#000" rx={0.5} />
    <rect x="11" y="11" width="10" height="10" fill="#fff" rx={0.5} />
    <rect x="36" y="4" width="24" height="24" fill="#fff" rx={1} />
    <rect x="40" y="8" width="16" height="16" fill="#000" rx={0.5} />
    <rect x="43" y="11" width="10" height="10" fill="#fff" rx={0.5} />
    <rect x="4" y="36" width="24" height="24" fill="#fff" rx={1} />
    <rect x="8" y="40" width="16" height="16" fill="#000" rx={0.5} />
    <rect x="11" y="43" width="10" height="10" fill="#fff" rx={0.5} />
    {/* Data cells */}
    {[
      [36,36],[40,36],[44,36],[48,36],
      [36,40],[44,40],[52,40],
      [36,44],[40,44],[48,44],[52,44],
      [36,48],[40,48],[44,48],
      [40,52],[44,52],[48,52],[52,52],
    ].map(([x,y], i) => (
      <rect key={i} x={x} y={y} width={4} height={4} fill="#fff" />
    ))}
  </svg>
);

export const DisplayBoard: React.FC<DisplayBoardProps> = ({ onNavigate }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [nextTickets, setNextTickets] = useState<Ticket[]>([]);
  const [clock, setClock] = useState(new Date());
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [animKey, setAnimKey] = useState(0);
  const prevTicketRef = useRef<string | null>(null);

  // Clock updater
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      const [tix, anns] = await Promise.all([
        api.getTickets(),
        api.getAnnouncements(),
      ]);
      setTickets(tix);
      setAnnouncements(anns.filter(a => a.active));
      const serving = tix.find(t => t.status === 'serving');
      const waiting = tix.filter(t => t.status === 'waiting').slice(0, 5);
      setNextTickets(waiting);

      // Detect new serving ticket
      if (serving && serving.id !== prevTicketRef.current) {
        prevTicketRef.current = serving.id;
        setCurrentTicket(serving);
        setAnimKey(k => k + 1);

        // Voice announcement
        if (voiceEnabled) {
          const counter = serving.counter_assigned ?? 1;
          const msg = `Now serving ticket number ${serving.ticket_number}. Please proceed to counter number ${counter}.`;
          const utterance = new SpeechSynthesisUtterance(msg);
          utterance.rate = 0.85;
          utterance.pitch = 1;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      } else if (!serving) {
        setCurrentTicket(null);
      }
    } catch { /* quiet */ }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [voiceEnabled]);

  const tickerMessages = [
    ...(announcements.map(a => a.message)),
    'Welcome to DQMS 2.0 — Smart Digital Queue Management System',
    'Please keep your ticket number visible at all times',
    'Elderly, disabled, and pregnant customers have priority access',
    'Scan the QR code on the right to join the queue from your phone',
  ].join('   •   ');

  const clockStr = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="display-board">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="board-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={() => onNavigate('welcome')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <ArrowLeft size={14} /> Exit
          </button>
          <div className="board-logo">DQMS</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="board-clock">{clockStr}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{dateStr}</div>
          </div>

          {/* Status indicators */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulseDot 2s infinite' }} />
              Live
            </div>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: voiceEnabled ? '#3b82f6' : '#64748b', cursor: 'pointer', padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              title="Toggle voice announcements"
            >
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {voiceEnabled ? 'Voice On' : 'Voice Off'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Board body ────────────────────────────────── */}
      <div className="board-body">
        {/* Main panel — NOW SERVING */}
        <div className="board-main-panel">
          <div className="board-label">NOW SERVING</div>

          {currentTicket ? (
            <>
              <div key={animKey} className="board-ticket-number" style={{ color: '#ffffff' }}>
                {currentTicket.ticket_number}
              </div>
              <div className="board-counter-label">
                COUNTER {currentTicket.counter_assigned ?? '—'}
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 24, justifyContent: 'center' }}>
                {currentTicket.services?.name && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Service</div>
                    <div style={{ fontSize: 16, color: '#e2e8f0', fontWeight: 700 }}>{currentTicket.services.name}</div>
                  </div>
                )}
                {currentTicket.customer_name && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Customer</div>
                    <div style={{ fontSize: 16, color: '#e2e8f0', fontWeight: 700 }}>{currentTicket.customer_name}</div>
                  </div>
                )}
              </div>

              {/* Animated ring */}
              <div style={{ marginTop: 32, position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid rgba(59, 130, 246, 0.4)',
                  animation: 'ripple 2s ease-out infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: 10, borderRadius: '50%',
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  animation: 'ripple 2s ease-out infinite', animationDelay: '0.5s',
                }} />
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(59, 130, 246, 0.6)',
                }}>
                  <span style={{ fontSize: 20 }}>✓</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 80, opacity: 0.1, fontWeight: 900, letterSpacing: -3, color: '#fff', lineHeight: 1 }}>—</div>
              <div style={{ fontSize: 16, color: '#64748b', marginTop: 16 }}>Waiting for next call...</div>
            </div>
          )}
        </div>

        {/* Right panel — NEXT */}
        <div className="board-next-panel">
          <div className="board-next-header">NEXT IN QUEUE</div>

          {nextTickets.length > 0 ? (
            nextTickets.map((t, i) => (
              <div key={t.id} className="board-next-item" style={{ opacity: 1 - i * 0.12 }}>
                <div>
                  <div className="board-next-number">{t.ticket_number}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {t.services?.name || 'Service'}
                  </div>
                </div>
                <div className="board-next-counter">
                  {t.customer_name ? t.customer_name.split(' ')[0] : '—'}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🕐</div>
              <div style={{ fontSize: 13 }}>Queue empty</div>
            </div>
          )}

          {/* Waiting count */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid #1e293b', padding: '16px 24px' }}>
            <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
              Total Waiting
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#3b82f6' }}>
              {tickets.filter(t => t.status === 'waiting').length}
            </div>
          </div>

          {/* QR code */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
              SCAN TO JOIN QUEUE
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <QRSmall />
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, textAlign: 'center' }}>
              {window.location.origin}/#login
            </div>
          </div>
        </div>
      </div>

      {/* ── Announcements ticker ───────────────────────── */}
      <div className="board-ticker">
        <div className="ticker-label">📢 ANNOUNCEMENTS</div>
        <div className="ticker-content-wrapper">
          {tickerMessages && (
            <div className="ticker-text">
              {tickerMessages}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{tickerMessages}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
