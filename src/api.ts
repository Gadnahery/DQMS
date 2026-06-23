import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase credentials state
let supabase: SupabaseClient | null = null;
let supabaseUrl = localStorage.getItem('supabase_url') || (import.meta.env ? import.meta.env.VITE_SUPABASE_URL : '') || '';
let supabaseKey = localStorage.getItem('supabase_key') || (import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : '') || '';

export const initSupabase = (url: string, key: string) => {
  if (url && key) {
    try {
      supabase = createClient(url, key);
      localStorage.setItem('supabase_url', url);
      localStorage.setItem('supabase_key', key);
      supabaseUrl = url;
      supabaseKey = key;
      console.log('Supabase client initialized successfully');
      return true;
    } catch (e) {
      console.error('Error initializing Supabase client:', e);
      return false;
    }
  } else {
    supabase = null;
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    supabaseUrl = '';
    supabaseKey = '';
    return false;
  }
};

// Try to initialize immediately on load
if (supabaseUrl && supabaseKey) {
  initSupabase(supabaseUrl, supabaseKey);
}

export const isSupabaseConfigured = () => {
  return supabase !== null;
};

export const getSupabaseConfig = () => {
  return { url: supabaseUrl, key: supabaseKey };
};

// Export raw client for realtime subscriptions
export const getSupabaseClient = () => supabase;

// Unified Data Interface
export interface Service {
  id: string;
  name: string;
  code: string;
  avg_handling_time_mins: number;
  color_theme: string;
  priority_weight?: number;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  priority: 'normal' | 'elderly' | 'disabled' | 'vip';
  status: 'waiting' | 'serving' | 'completed' | 'cancelled';
  counter_assigned: number | null;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  services?: Service; 
}

export interface Counter {
  id: number;
  counter_name: string;
  status: 'online' | 'offline' | 'paused';
  current_service_id: string | null;
  staff_name?: string;
}

export interface Announcement {
  id: string;
  message: string;
  active: boolean;
  created_at: string;
}

export interface Feedback {
  id: string;
  ticket_number: string;
  rating: number;
  comments: string;
  created_at: string;
}

// ----------------------------------------------------
// LOCAL STORAGE DATABASE MOCKS (When Supabase is disconnected)
// ----------------------------------------------------

const getMockData = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(`dqms_mock_db_${key}`);
  return data ? JSON.parse(data) : defaultValue;
};

const setMockData = <T>(key: string, data: T): void => {
  localStorage.setItem(`dqms_mock_db_${key}`, JSON.stringify(data));
};

// Seed initial values for local demo mode if empty
if (!localStorage.getItem('dqms_mock_db_services')) {
  setMockData<Service[]>('services', [
    { id: 's1', name: 'General Inquiries', code: 'G', avg_handling_time_mins: 5, color_theme: '#3b82f6' },
    { id: 's2', name: 'Teller & Payments', code: 'P', avg_handling_time_mins: 8, color_theme: '#10b981' },
    { id: 's3', name: 'Card & Consultation', code: 'C', avg_handling_time_mins: 15, color_theme: '#8b5cf6' },
    { id: 's4', name: 'Technical Support', code: 'S', avg_handling_time_mins: 10, color_theme: '#f59e0b' }
  ]);
  setMockData<Ticket[]>('tickets', []);
  setMockData<Counter[]>('counters', [
    { id: 1, counter_name: 'Counter 1', status: 'offline', current_service_id: null },
    { id: 2, counter_name: 'Counter 2', status: 'offline', current_service_id: null },
    { id: 3, counter_name: 'Counter 3', status: 'offline', current_service_id: null }
  ]);
  setMockData<Announcement[]>('announcements', [
    { id: 'a1', message: 'Welcome to our AI-Powered Smart Digital Queue system!', active: true, created_at: new Date().toISOString() }
  ]);
  setMockData<Feedback[]>('feedback', []);
}

// Simulated Hardware Ping logs
let mockPings: Record<number, { lastPingAt: string; ip: string }> = {};

// ----------------------------------------------------
// UNIFIED DATA SERVICES
// ----------------------------------------------------

export const api = {
  async getUserRole(userId: string): Promise<string> {
    if (!supabase) return localStorage.getItem('user_role') || 'customer';
    const { data, error } = await supabase.from('user_roles').select('role').eq('id', userId).single();
    if (error) {
      console.warn('Failed to fetch role:', error.message);
      return 'customer';
    }
    return data?.role || 'customer';
  },

  // SERVICES
  getServices: async (): Promise<Service[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('services').select('*').order('name');
      if (error) throw error;
      return data || [];
    } else {
      return getMockData<Service[]>('services', []);
    }
  },

  createService: async (name: string, code: string, avgHandlingTimeMins: number, colorTheme: string): Promise<Service> => {
    if (supabase) {
      const { data, error } = await supabase.from('services').insert([{
        name,
        code: code.toUpperCase(),
        avg_handling_time_mins: avgHandlingTimeMins,
        color_theme: colorTheme
      }]).select();
      if (error) throw error;
      return data[0];
    } else {
      const list = getMockData<Service[]>('services', []);
      const newService: Service = {
        id: 's_' + Math.random().toString(36).substr(2, 9),
        name,
        code: code.toUpperCase(),
        avg_handling_time_mins: avgHandlingTimeMins,
        color_theme: colorTheme
      };
      list.push(newService);
      setMockData('services', list);
      return newService;
    }
  },

  deleteService: async (id: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
    } else {
      const list = getMockData<Service[]>('services', []);
      const filtered = list.filter(s => s.id !== id);
      setMockData('services', filtered);
    }
  },

  // TICKETS
  getTickets: async (): Promise<Ticket[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('tickets').select('*, services(*)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const tickets = getMockData<Ticket[]>('tickets', []);
      const services = getMockData<Service[]>('services', []);
      return tickets.map(t => ({
        ...t,
        services: services.find(s => s.id === t.service_id)
      })).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  createTicket: async (serviceId: string, name: string, phone: string, priority: string = 'normal'): Promise<{ success: boolean; ticket: Ticket; wait_time_mins: number; people_ahead: number }> => {
    if (supabase) {
      const { data, error } = await supabase.rpc('join_queue', {
        service_id_param: serviceId,
        name_param: name || 'Walk-in',
        phone_param: phone || '',
        priority_param: priority
      });
      if (error) throw error;
      
      const parsedRes = data as any;
      // Get fuller ticket details with joined service
      const tickets = await api.getTickets();
      const fullTicket = tickets.find(t => t.id === parsedRes.ticket.id);
      
      return {
        success: parsedRes.success,
        ticket: fullTicket || parsedRes.ticket,
        wait_time_mins: parsedRes.wait_time_mins,
        people_ahead: parsedRes.people_ahead
      };
    } else {
      const services = getMockData<Service[]>('services', []);
      const tickets = getMockData<Ticket[]>('tickets', []);
      const service = services.find(s => s.id === serviceId);
      if (!service) throw new Error('Service not found');

      // Emulate sequence
      const todayStr = new Date().toISOString().split('T')[0];
      const count = tickets.filter(t => t.service_id === serviceId && t.created_at.startsWith(todayStr)).length;
      const nextNum = 101 + count;
      const ticketNum = `${service.code}-${nextNum}`;

      const peopleAhead = tickets.filter(t => t.service_id === serviceId && t.status === 'waiting').length;
      const waitTimeMins = peopleAhead * service.avg_handling_time_mins;

      const newTicket: Ticket = {
        id: 't_' + Math.random().toString(36).substr(2, 9),
        ticket_number: ticketNum,
        service_id: serviceId,
        customer_name: name || 'Walk-in Terminal',
        customer_phone: phone || '',
        priority: priority as any,
        status: 'waiting',
        counter_assigned: null,
        created_at: new Date().toISOString(),
        called_at: null,
        completed_at: null,
        services: service
      };

      tickets.push(newTicket);
      setMockData('tickets', tickets);

      return {
        success: true,
        ticket: newTicket,
        wait_time_mins: waitTimeMins,
        people_ahead: peopleAhead
      };
    }
  },

  callNextTicket: async (counterId: number, serviceId?: string): Promise<Ticket> => {
    if (supabase) {
      const { data, error } = await supabase.rpc('call_next', {
        counter_id_param: counterId,
        service_id_param: serviceId || null
      });
      if (error) throw error;
      
      const parsedRes = data as any;
      if (!parsedRes.success) {
        throw new Error(parsedRes.error || 'No customers waiting');
      }

      // Fetch the updated ticket record
      const tickets = await api.getTickets();
      const updated = tickets.find(t => t.id === parsedRes.ticket_id);
      if (!updated) throw new Error('Failed to find called ticket');
      return updated;
    } else {
      const tickets = getMockData<Ticket[]>('tickets', []);
      const counters = getMockData<Counter[]>('counters', []);
      
      let waiting = tickets.filter(t => t.status === 'waiting');
      if (serviceId) {
        waiting = waiting.filter(t => t.service_id === serviceId);
      }

      // Sort by priority weights, then FIFO
      waiting.sort((a, b) => {
        const priorityScore = (p: string) => {
          if (p === 'vip') return 1;
          if (p === 'disabled') return 2;
          if (p === 'elderly') return 3;
          return 4;
        };
        const scoreDiff = priorityScore(a.priority) - priorityScore(b.priority);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      if (waiting.length === 0) {
        throw new Error('No customers waiting');
      }

      const called = waiting[0];
      called.status = 'serving';
      called.counter_assigned = counterId;
      called.called_at = new Date().toISOString();

      setMockData('tickets', tickets);

      // Update counter status
      const counter = counters.find(c => c.id === counterId);
      if (counter) {
        counter.status = 'online';
        if (serviceId) counter.current_service_id = serviceId;
        setMockData('counters', counters);
      }

      return called;
    }
  },

  updateTicketStatus: async (ticketId: string, status: 'completed' | 'cancelled' | 'waiting'): Promise<Ticket> => {
    if (supabase) {
      const updateData: any = { status };
      if (status === 'completed' || status === 'cancelled') {
        updateData.completed_at = new Date().toISOString();
      } else if (status === 'waiting') {
        updateData.created_at = new Date().toISOString();
        updateData.called_at = null;
        updateData.counter_assigned = null;
      }

      const { error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', ticketId)
        .select();
      
      if (error) throw error;
      
      // Re-fetch with join
      const tickets = await api.getTickets();
      return tickets.find(t => t.id === ticketId)!;
    } else {
      const tickets = getMockData<Ticket[]>('tickets', []);
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) throw new Error('Ticket not found');

      ticket.status = status;
      if (status === 'completed' || status === 'cancelled') {
        ticket.completed_at = new Date().toISOString();
      } else if (status === 'waiting') {
        ticket.created_at = new Date().toISOString();
        ticket.called_at = null;
        ticket.counter_assigned = null;
      }

      setMockData('tickets', tickets);
      return ticket;
    }
  },

  // COUNTERS
  getCounters: async (): Promise<Counter[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('counters').select('*').order('id');
      if (error) throw error;
      return data || [];
    } else {
      return getMockData<Counter[]>('counters', []);
    }
  },

  updateCounter: async (counterId: number, status?: string, currentServiceId?: string | null): Promise<Counter> => {
    if (supabase) {
      const updateData: any = {};
      if (status) updateData.status = status;
      if (currentServiceId !== undefined) updateData.current_service_id = currentServiceId;
      updateData.last_active_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('counters')
        .update(updateData)
        .eq('id', counterId)
        .select();

      if (error) throw error;
      return data[0];
    } else {
      const list = getMockData<Counter[]>('counters', []);
      const counter = list.find(c => c.id === counterId);
      if (!counter) throw new Error('Counter not found');

      if (status) counter.status = status as any;
      if (currentServiceId !== undefined) counter.current_service_id = currentServiceId;
      setMockData('counters', list);
      return counter;
    }
  },

  // ANNOUNCEMENTS
  getAnnouncements: async (): Promise<Announcement[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      return getMockData<Announcement[]>('announcements', []);
    }
  },

  createAnnouncement: async (message: string): Promise<Announcement> => {
    if (supabase) {
      await supabase.from('announcements').update({ active: false }).eq('active', true);
      const { data, error } = await supabase.from('announcements').insert([{
        message,
        active: true
      }]).select();

      if (error) throw error;
      return data[0];
    } else {
      const list = getMockData<Announcement[]>('announcements', []);
      list.forEach(a => a.active = false);

      const newAnn: Announcement = {
        id: 'a_' + Math.random().toString(36).substr(2, 9),
        message,
        active: true,
        created_at: new Date().toISOString()
      };
      list.push(newAnn);
      setMockData('announcements', list);
      return newAnn;
    }
  },

  // FEEDBACK
  getFeedback: async (): Promise<Feedback[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      return getMockData<Feedback[]>('feedback', []);
    }
  },

  submitFeedback: async (ticketNumber: string, rating: number, comments: string): Promise<Feedback> => {
    if (supabase) {
      // Analyze sentiment briefly in JS
      const lowComments = comments.toLowerCase();
      let sentiment = 'neutral';
      if (lowComments.includes('good') || lowComments.includes('great') || lowComments.includes('happy') || lowComments.includes('fast') || rating >= 4) {
        sentiment = 'positive';
      } else if (lowComments.includes('slow') || lowComments.includes('wait') || lowComments.includes('bad') || lowComments.includes('poor') || rating <= 2) {
        sentiment = 'negative';
      }

      const { data, error } = await supabase.from('feedback').insert([{
        ticket_number: ticketNumber,
        rating,
        comments,
        sentiment
      }]).select();

      if (error) throw error;
      return data[0];
    } else {
      const list = getMockData<Feedback[]>('feedback', []);
      
      const lowComments = comments.toLowerCase();
      let sentiment = 'neutral';
      if (lowComments.includes('good') || lowComments.includes('great') || rating >= 4) {
        sentiment = 'positive';
      } else if (lowComments.includes('slow') || lowComments.includes('wait') || rating <= 2) {
        sentiment = 'negative';
      }

      const newFb: Feedback = {
        id: 'f_' + Math.random().toString(36).substr(2, 9),
        ticket_number: ticketNumber,
        rating,
        comments,
        created_at: new Date().toISOString(),
        ...{ sentiment }
      } as any;
      list.push(newFb);
      setMockData('feedback', list);
      return newFb;
    }
  },

  // HARDWARE SIMULATOR & PINGS
  getEsp32Status: async (counterId: number) => {
    if (supabase) {
      // Fetch ping status
      const { data: pingData } = await supabase
        .from('esp32_pings')
        .select('*')
        .eq('id', counterId)
        .single();
        
      const online = pingData && (new Date().getTime() - new Date(pingData.last_ping_at).getTime() < 15000);
      
      // Fetch LCD text and triggers
      const { data: hardwareState } = await supabase.rpc('get_hardware_status', {
        counter_id_param: counterId
      });

      const parsed = hardwareState as any;

      return {
        online: !!online,
        lastPing: pingData?.last_ping_at || null,
        lcd: {
          line1: parsed?.lcd_line1 || 'Serving: None',
          line2: parsed?.lcd_line2 || 'Waiting: 0'
        },
        pendingAlert: {
          beep: parsed?.alert_beep || false,
          led: parsed?.alert_led || 'none'
        }
      };
    } else {
      // Local Mock logic
      const ping = mockPings[counterId];
      const online = ping && (new Date().getTime() - new Date(ping.lastPingAt).getTime() < 15000);

      const tickets = getMockData<Ticket[]>('tickets', []);
      const counters = getMockData<Counter[]>('counters', []);
      const counter = counters.find(c => c.id === counterId);

      const serving = tickets.find(t => t.status === 'serving' && t.counter_assigned === counterId);
      const waiting = tickets.filter(t => t.status === 'waiting' && (!counter?.current_service_id || t.service_id === counter.current_service_id)).length;

      // Check if called in the last 8 seconds to flash indicators
      let beep = false;
      let led = 'none';
      if (serving?.called_at) {
        const timeDiff = new Date().getTime() - new Date(serving.called_at).getTime();
        if (timeDiff < 8000) {
          beep = true;
          led = 'green';
        }
      }

      return {
        online: !!online,
        lastPing: ping?.lastPingAt || null,
        lcd: {
          line1: `Serving: ${serving?.ticket_number || 'None'}`,
          line2: `Waiting: ${waiting}`
        },
        pendingAlert: {
          beep,
          led
        }
      };
    }
  },

  pingEsp32: async (counterId: number, ipAddress: string): Promise<void> => {
    if (supabase) {
      await supabase.rpc('ping_esp32', {
        counter_id_param: counterId,
        ip_address_param: ipAddress
      });
    } else {
      mockPings[counterId] = {
        lastPingAt: new Date().toISOString(),
        ip: ipAddress
      };
    }
  },

  triggerSimulatorAction: async (counterId: number, action: 'beep' | 'green_led' | 'red_led' | 'clear') => {
    // Emulator helper to mock physical button inputs directly on the database
    if (supabase) {
      if (action === 'beep' || action === 'green_led') {
        // Mock a call by touching the called_at timestamp of the active ticket
        const { data: tickets } = await supabase
          .from('tickets')
          .select('*')
          .eq('status', 'serving')
          .eq('counter_assigned', counterId)
          .order('called_at', { ascending: false })
          .limit(1);
          
        if (tickets && tickets.length > 0) {
          await supabase.from('tickets').update({ called_at: new Date().toISOString() }).eq('id', tickets[0].id);
        }
      }
    } else {
      // Local mocks handled in getEsp32Status comparison
      if (action === 'beep' || action === 'green_led') {
        const tickets = getMockData<Ticket[]>('tickets', []);
        const active = tickets.find(t => t.status === 'serving' && t.counter_assigned === counterId);
        if (active) {
          active.called_at = new Date().toISOString();
          setMockData('tickets', tickets);
        }
      }
    }
  },

  pressPhysicalButton: async (counterId: number, buttonId: 'join' | 'next' | 'reset') => {
    if (buttonId === 'join') {
      const services = await api.getServices();
      if (services.length > 0) {
        await api.createTicket(services[0].id, 'Walk-in Customer', '', 'normal');
      }
    } else if (buttonId === 'next') {
      const counters = await api.getCounters();
      const current = counters.find(c => c.id === counterId);
      await api.callNextTicket(counterId, current?.current_service_id || undefined);
    } else if (buttonId === 'reset') {
      if (supabase) {
        await supabase.rpc('reset_queue');
      } else {
        const tickets = getMockData<Ticket[]>('tickets', []);
        tickets.forEach(t => {
          if (t.status === 'waiting' || t.status === 'serving') {
            t.status = 'cancelled';
            t.completed_at = new Date().toISOString();
          }
        });
        setMockData('tickets', tickets);
      }
    }
  },

  // CONVENIENCE ALIASES
  updateService: async (id: string, data: { name?: string; code?: string; avg_handling_time_mins?: number; color_theme?: string }): Promise<Service> => {
    if (supabase) {
      const { data: result, error } = await supabase.from('services').update(data).eq('id', id).select();
      if (error) throw error;
      return result[0];
    } else {
      const list = getMockData<Service[]>('services', []);
      const svc = list.find(s => s.id === id);
      if (!svc) throw new Error('Service not found');
      if (data.name !== undefined) svc.name = data.name;
      if (data.code !== undefined) svc.code = data.code.toUpperCase();
      if (data.avg_handling_time_mins !== undefined) svc.avg_handling_time_mins = data.avg_handling_time_mins;
      if (data.color_theme !== undefined) svc.color_theme = data.color_theme;
      setMockData('services', list);
      return svc;
    }
  },

  updateCounterStatus: async (counterId: number, status: 'online' | 'offline' | 'paused'): Promise<Counter> => {
    return api.updateCounter(counterId, status);
  },
};
