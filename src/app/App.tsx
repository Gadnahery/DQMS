import { useState, useEffect, createContext, useContext } from 'react';
import { Welcome } from '../features/landing/Welcome';
import { LoginPage } from '../features/auth/LoginPage';
import { CustomerPortal } from '../features/customer/CustomerPortal';
import { StaffPortal } from '../features/staff/StaffPortal';
import { SupervisorPortal } from '../features/supervisor/SupervisorPortal';
import { AdminPortal } from '../features/admin/AdminPortal';
import { DisplayBoard } from '../features/display/DisplayBoard';

/* ─── Theme Context ─────────────────────────────────────────── */
interface ThemeCtx {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}
export const ThemeContext = createContext<ThemeCtx>({
  theme: 'light',
  toggleTheme: () => {},
});
export const useTheme = () => useContext(ThemeContext);

/* ─── Language Context ──────────────────────────────────────── */
interface LangCtx {
  lang: 'en' | 'sw';
  setLang: (l: 'en' | 'sw') => void;
  t: (key: string) => string;
}

// Swahili translations for Customer Portal
const translations: Record<string, Record<string, string>> = {
  en: {
    home: 'Home',
    ticket: 'Ticket',
    track: 'Track',
    notifications: 'Notifications',
    profile: 'Profile',
    join_queue: 'Join Queue',
    good_morning: 'Good Morning',
    good_afternoon: 'Good Afternoon',
    good_evening: 'Good Evening',
    services: 'Services',
    your_ticket: 'Your Ticket',
    people_ahead: 'People Ahead',
    estimated_wait: 'Est. Wait',
    counter: 'Counter',
    ticket_issued: 'Ticket Issued',
    waiting: 'Waiting',
    almost_ready: 'Almost Ready',
    now_serving: 'Now Serving',
    completed: 'Completed',
    no_notifications: 'No Notifications',
    theme: 'Theme',
    language: 'Language',
    accessibility: 'Accessibility',
    feedback: 'Feedback',
    settings: 'Settings',
    logout: 'Logout',
    guest_mode: 'Guest Mode',
    create_account: 'Create Account',
    dark_mode: 'Dark Mode',
    high_contrast: 'High Contrast',
    select_service: 'Select Service',
    enter_your_info: 'Your Information',
    full_name: 'Full Name',
    phone_number: 'Phone Number',
    review_confirm: 'Review & Confirm',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    cancel: 'Cancel',
    submit: 'Submit',
    mins: 'mins',
    position: 'Position',
    service: 'Service',
    name: 'Name',
    wait_time: 'Wait Time',
    no_active_ticket: 'No active ticket',
    join_a_queue: 'Tap "Join Queue" to get started',
    all: 'All',
    popular: 'Popular',
    recommended: 'Recommended',
    search_services: 'Search services...',
  },
  sw: {
    home: 'Nyumbani',
    ticket: 'Tiketi',
    track: 'Fuatilia',
    notifications: 'Arifa',
    profile: 'Wasifu',
    join_queue: 'Jiunge na Foleni',
    good_morning: 'Habari za Asubuhi',
    good_afternoon: 'Habari za Mchana',
    good_evening: 'Habari za Jioni',
    services: 'Huduma',
    your_ticket: 'Tiketi Yako',
    people_ahead: 'Watu Mbele',
    estimated_wait: 'Muda wa Kusubiri',
    counter: 'Kaunta',
    ticket_issued: 'Tiketi Imetolewa',
    waiting: 'Kusubiri',
    almost_ready: 'Karibu Tayari',
    now_serving: 'Inahudumia Sasa',
    completed: 'Imekamilika',
    no_notifications: 'Hakuna Arifa',
    theme: 'Mandhari',
    language: 'Lugha',
    accessibility: 'Upatikanaji',
    feedback: 'Maoni',
    settings: 'Mipangilio',
    logout: 'Toka',
    guest_mode: 'Mgeni',
    create_account: 'Fungua Akaunti',
    dark_mode: 'Hali ya Giza',
    high_contrast: 'Tofauti Kubwa',
    select_service: 'Chagua Huduma',
    enter_your_info: 'Maelezo Yako',
    full_name: 'Jina Kamili',
    phone_number: 'Nambari ya Simu',
    review_confirm: 'Kagua na Thibitisha',
    confirm: 'Thibitisha',
    back: 'Rudi',
    next: 'Endelea',
    cancel: 'Ghairi',
    submit: 'Wasilisha',
    mins: 'dak',
    position: 'Nafasi',
    service: 'Huduma',
    name: 'Jina',
    wait_time: 'Muda wa Kusubiri',
    no_active_ticket: 'Hakuna tiketi inayoendelea',
    join_a_queue: 'Bonyeza "Jiunge na Foleni" kuanza',
    all: 'Zote',
    popular: 'Maarufu',
    recommended: 'Iliyopendekezwa',
    search_services: 'Tafuta huduma...',
  }
};

export const LangContext = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});
export const useLang = () => useContext(LangContext);

/* ─── App ───────────────────────────────────────────────────── */
function App() {
  const [currentView, setCurrentView] = useState<string>('welcome');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('dqms-theme') as 'dark' | 'light') || 'light';
  });
  const [lang, setLang] = useState<'en' | 'sw'>(() => {
    return (localStorage.getItem('dqms-lang') as 'en' | 'sw') || 'en';
  });

  // Apply theme attribute to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dqms-theme', theme);
  }, [theme]);

  // Apply language
  useEffect(() => {
    localStorage.setItem('dqms-lang', lang);
  }, [lang]);

  const toggleTheme = () =>
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  const t = (key: string): string => {
    return translations[lang]?.[key] ?? translations['en']?.[key] ?? key;
  };

  // Hash-based routing
  useEffect(() => {
    const getView = () => {
      const hash = window.location.hash.substring(1);
      return hash || 'welcome';
    };
    setCurrentView(getView());

    const handleHashChange = () => setCurrentView(getView());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (view: string) => {
    window.location.hash = view;
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <LangContext.Provider value={{ lang, setLang, t }}>
        {currentView === 'welcome'    && <Welcome onNavigate={handleNavigate} />}
        {currentView === 'login'      && <LoginPage onNavigate={handleNavigate} />}
        {currentView === 'customer'   && <CustomerPortal onNavigate={handleNavigate} />}
        {currentView === 'staff'      && <StaffPortal onNavigate={handleNavigate} />}
        {currentView === 'supervisor' && <SupervisorPortal onNavigate={handleNavigate} />}
        {currentView === 'admin'      && <AdminPortal onNavigate={handleNavigate} />}
        {currentView === 'display'    && <DisplayBoard onNavigate={handleNavigate} />}
      </LangContext.Provider>
    </ThemeContext.Provider>
  );
}

export default App;
