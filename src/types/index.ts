export interface Service {
  id: string;
  name: string;
  code: string;
  avg_handling_time_mins: number;
  color_theme: string;
  priority_weight?: number;
  description?: string;
  max_capacity?: number;
  is_active?: boolean;
  created_at?: string;
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
  branch_id?: string | null;
  last_active_at?: string;
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

export interface Branch {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance' | 'paused';
  counters?: number;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target: string | null;
  result: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  avatar_url: string;
  branch_id: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  role?: 'admin' | 'supervisor' | 'staff' | 'customer';
  created_at?: string;
}
