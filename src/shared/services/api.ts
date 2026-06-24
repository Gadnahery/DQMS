import { supabase, getSupabaseClient } from '../../lib/supabase';
import type { Service, Ticket, Counter, Announcement, Feedback, Branch, AppSetting, AuditLog, User } from '../../types';

export { getSupabaseClient };

type UserRole = 'admin' | 'supervisor' | 'staff' | 'customer';

const ADMIN_EMAILS = ['gadnahery7@gmail.com'];

const isUserRole = (role: unknown): role is UserRole =>
  typeof role === 'string' && ['admin', 'supervisor', 'staff', 'customer'].includes(role);

export const api = {
  async getUserRole(userId: string, userEmail?: string | null): Promise<UserRole> {
    const email = userEmail?.trim().toLowerCase();
    if (email && ADMIN_EMAILS.includes(email)) {
      return 'admin';
    }

    const { data: roleRow, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (!roleError && isUserRole(roleRow?.role)) {
      return roleRow.role;
    }

    const { data: rpcRole, error: rpcError } = await supabase.rpc('get_my_role');
    if (!rpcError && isUserRole(rpcRole)) {
      return rpcRole;
    }

    console.warn('Failed to fetch role:', roleError?.message || rpcError?.message || 'No role assigned');
    return 'customer';
  },

  getServices: async (): Promise<Service[]> => {
    const { data, error } = await supabase.from('services').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  createService: async (name: string, code: string, avgHandlingTimeMins: number, colorTheme: string): Promise<Service> => {
    const { data, error } = await supabase.from('services').insert([{
      name, code, avg_handling_time_mins: avgHandlingTimeMins, color_theme: colorTheme, is_active: true
    }]).select().single();
    if (error) throw error;
    return data;
  },

  updateService: async (id: string, updates: Partial<Service>): Promise<Service> => {
    const { data, error } = await supabase.from('services').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  deleteService: async (id: string): Promise<void> => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) throw error;
  },

  setServiceActive: async (id: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase.from('services').update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
  },

  getTickets: async (): Promise<Ticket[]> => {
    const { data, error } = await supabase.from('tickets').select('*, services(*)').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  createTicket: async (serviceId: string, customerName: string, customerPhone: string, priority: string = 'normal'): Promise<any> => {
    const { data, error } = await supabase.rpc('join_queue', {
      service_id_param: serviceId,
      name_param: customerName,
      phone_param: customerPhone,
      priority_param: priority
    });
    if (error) throw error;
    return data;
  },

  callNextTicket: async (counterId: number, serviceId?: string): Promise<any> => {
    const { data, error } = await supabase.rpc('call_next', {
      counter_id_param: counterId,
      service_id_param: serviceId || null
    });
    if (error) throw error;
    return data;
  },

  updateTicketStatus: async (ticketId: string, status: string): Promise<void> => {
    const updates: any = { status };
    if (status === 'completed' || status === 'cancelled') updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from('tickets').update(updates).eq('id', ticketId);
    if (error) throw error;
  },

  getCounters: async (): Promise<Counter[]> => {
    const { data, error } = await supabase.from('counters').select('*').order('id');
    if (error) throw error;
    return data || [];
  },

  createCounter: async (counter: Counter): Promise<Counter> => {
    const { data, error } = await supabase.from('counters').insert([counter]).select().single();
    if (error) throw error;
    return data;
  },

  updateCounter: async (id: number, updates: Partial<Counter>): Promise<void> => {
    const { error } = await supabase.from('counters').update(updates).eq('id', id);
    if (error) throw error;
  },

  deleteCounter: async (id: number): Promise<void> => {
    const { error } = await supabase.from('counters').delete().eq('id', id);
    if (error) throw error;
  },

  updateCounterStatus: async (id: number, status: string): Promise<void> => {
    const { error } = await supabase.from('counters').update({ status }).eq('id', id);
    if (error) throw error;
  },

  getAnnouncements: async (): Promise<Announcement[]> => {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  createAnnouncement: async (message: string): Promise<Announcement> => {
    const { data, error } = await supabase.from('announcements').insert([{ message, active: true }]).select().single();
    if (error) throw error;
    return data;
  },

  getBranches: async (): Promise<Branch[]> => {
    const { data, error } = await supabase.from('branches').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    const { data: users, error: usersError } = await supabase.from('auth.users').select('id,email,created_at').order('created_at', { ascending: false });
    const { data: roles, error: rolesError } = await supabase.from('user_roles').select('id,role');
    if (usersError && rolesError) throw usersError || rolesError;
    const roleMap = (roles || []).reduce<Record<string, string>>((acc, r: any) => { acc[r.id] = r.role; return acc; }, {});
    return (users || []).map((u: any) => ({ id: u.id, email: u.email, role: (roleMap[u.id] as any) || 'customer', created_at: u.created_at }));
  },

  updateUserRole: async (id: string, role: string): Promise<void> => {
    const { error } = await supabase.from('user_roles').upsert([{ id, role }], { onConflict: 'id' });
    if (error) throw error;
  },

  createBranch: async (branch: Pick<Branch, 'name' | 'location' | 'status'>): Promise<Branch> => {
    const { data, error } = await supabase.from('branches').insert([branch]).select().single();
    if (error) throw error;
    return data;
  },

  updateBranch: async (id: string, updates: Partial<Branch>): Promise<Branch> => {
    const { data, error } = await supabase.from('branches').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  deleteBranch: async (id: string): Promise<void> => {
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (error) throw error;
  },

  getSettings: async (): Promise<Record<string, string>> => {
    const { data, error } = await supabase.from('app_settings').select('key,value');
    if (error) throw error;
    return (data || []).reduce<Record<string, string>>((acc: Record<string, string>, setting: AppSetting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
  },

  saveSettings: async (settings: Record<string, string>): Promise<void> => {
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
  },

  getAuditLogs: async (): Promise<AuditLog[]> => {
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  },

  getFeedback: async (): Promise<Feedback[]> => {
    const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  submitFeedback: async (ticketNumber: string, rating: number, comments: string, sentiment: string = 'neutral'): Promise<void> => {
    const { error } = await supabase.from('feedback').insert([{
      ticket_number: ticketNumber,
      rating,
      comments,
      sentiment
    }]);
    if (error) throw error;
  },

  getEsp32Status: async (counterId: number): Promise<any> => {
    const { data, error } = await supabase.rpc('get_hardware_status', { counter_id_param: counterId });
    if (error) throw error;
    return data;
  },

  pressPhysicalButton: async (counterId: number, buttonId: 'join' | 'next' | 'reset') => {
    if (buttonId === 'join') {
      const { data: services } = await supabase.from('services').select('*').limit(1);
      if (services && services.length > 0) {
        await supabase.rpc('join_queue', { service_id_param: services[0].id, name_param: 'Walk-in', phone_param: '', priority_param: 'normal' });
      }
    } else if (buttonId === 'next') {
      const { data: counters } = await supabase.from('counters').select('current_service_id').eq('id', counterId).single();
      await supabase.rpc('call_next', { counter_id_param: counterId, service_id_param: counters?.current_service_id || null });
    } else if (buttonId === 'reset') {
      await supabase.rpc('reset_queue');
    }
  }
};
