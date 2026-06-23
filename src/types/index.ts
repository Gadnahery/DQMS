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

export interface Branch {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
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
