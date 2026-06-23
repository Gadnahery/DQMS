-- Enable UUID generator extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. TABLES DEFINITIONS
-- ==========================================

-- Services table
create table if not exists public.services (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  code text not null unique,
  avg_handling_time_mins integer default 5,
  color_theme text default '#3b82f6',
  priority_weight integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tickets table
create table if not exists public.tickets (
  id uuid default gen_random_uuid() primary key,
  ticket_number text not null,
  service_id uuid references public.services(id) on delete cascade,
  customer_name text default 'Anonymous',
  customer_phone text default '',
  priority text check (priority in ('normal', 'elderly', 'disabled', 'vip')) default 'normal',
  status text check (status in ('waiting', 'serving', 'completed', 'cancelled')) default 'waiting',
  counter_assigned integer,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  called_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Counters table
create table if not exists public.counters (
  id integer primary key,
  counter_name text not null,
  status text check (status in ('online', 'offline', 'paused')) default 'offline',
  current_service_id uuid references public.services(id) on delete set null,
  last_active_at timestamp with time zone default timezone('utc'::text, now())
);

-- Announcements table
create table if not exists public.announcements (
  id uuid default gen_random_uuid() primary key,
  message text not null,
  active boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Feedback table
create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  ticket_number text not null,
  rating integer check (rating >= 1 and rating <= 5),
  comments text,
  sentiment text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ESP32 Heartbeat tracking
create table if not exists public.esp32_pings (
  id integer primary key references public.counters(id) on delete cascade,
  last_ping_at timestamp with time zone default timezone('utc'::text, now()),
  ip_address text
);

-- Populate default counters if not exists
insert into public.counters (id, counter_name, status) values 
(1, 'Counter 1', 'offline'),
(2, 'Counter 2', 'offline'),
(3, 'Counter 3', 'offline')
on conflict (id) do nothing;

-- Initialize ESP32 pings if not exists
insert into public.esp32_pings (id, ip_address) values
(1, '127.0.0.1'),
(2, '127.0.0.1'),
(3, '127.0.0.1')
on conflict (id) do nothing;

-- ==========================================
-- 2. POSTGRES FUNCTIONS (RPCs for ESP32 & Client)
-- ==========================================

-- Function to Join the Queue (Stateless generation of ticket numbers)
create or replace function public.join_queue(
  service_id_param uuid,
  name_param text,
  phone_param text,
  priority_param text
)
returns json as $$
declare
  service_code text;
  today_date date;
  ticket_seq integer;
  ticket_num text;
  new_ticket json;
  avg_time integer;
  people_ahead_count integer;
  wait_mins integer;
begin
  today_date := current_date;
  
  -- Get Service details
  select code, avg_handling_time_mins into service_code, avg_time 
  from public.services where id = service_id_param;
  
  if service_code is null then
    raise exception 'Service not found';
  end if;

  -- Count service tickets generated today
  select count(*) into ticket_seq 
  from public.tickets 
  where service_id = service_id_param and created_at::date = today_date;
  
  ticket_seq := ticket_seq + 101;
  ticket_num := service_code || '-' || ticket_seq;

  -- Calculate people waiting ahead in line
  select count(*) into people_ahead_count
  from public.tickets
  where service_id = service_id_param and status = 'waiting';

  wait_mins := people_ahead_count * avg_time;

  -- Insert ticket
  insert into public.tickets (
    ticket_number, service_id, customer_name, customer_phone, priority, status
  ) values (
    ticket_num, service_id_param, name_param, phone_param, priority_param, 'waiting'
  )
  returning json_build_object(
    'id', id,
    'ticket_number', ticket_number,
    'status', status,
    'created_at', created_at
  ) into new_ticket;

  return json_build_object(
    'success', true,
    'ticket', new_ticket,
    'people_ahead', people_ahead_count,
    'wait_time_mins', wait_mins
  );
end;
$$ language plpgsql security definer;

-- Function to Call Next Customer (Staff operations)
create or replace function public.call_next(
  counter_id_param integer,
  service_id_param uuid
)
returns json as $$
declare
  next_ticket record;
begin
  -- Find oldest waiting ticket (prioritize VIP/Disabled, then FIFO)
  select * into next_ticket
  from public.tickets
  where status = 'waiting' and (service_id_param is null or service_id = service_id_param)
  order by 
    case 
      when priority = 'vip' then 1
      when priority = 'disabled' then 2
      when priority = 'elderly' then 3
      else 4
    end asc, 
    created_at asc
  limit 1
  for update skip locked;

  if next_ticket.id is null then
    return json_build_object('success', false, 'error', 'No customers waiting');
  end if;

  -- Update status
  update public.tickets
  set status = 'serving', counter_assigned = counter_id_param, called_at = now()
  where id = next_ticket.id;

  -- Update counter state
  update public.counters
  set status = 'online', last_active_at = now()
  where id = counter_id_param;

  return json_build_object(
    'success', true,
    'ticket_id', next_ticket.id,
    'ticket_number', next_ticket.ticket_number,
    'customer_name', next_ticket.customer_name,
    'counter', counter_id_param
  );
end;
$$ language plpgsql security definer;

-- Function for ESP32 status updates
create or replace function public.get_hardware_status(
  counter_id_param integer
)
returns json as $$
declare
  now_serving_num text;
  waiting_count integer;
  last_call_time timestamp with time zone;
  buzzer_flag boolean;
  led_flag text;
  assigned_svc uuid;
begin
  -- Get counter service
  select current_service_id into assigned_svc from public.counters where id = counter_id_param;

  -- Get current serving number
  select ticket_number, called_at into now_serving_num, last_call_time
  from public.tickets
  where status = 'serving' and counter_assigned = counter_id_param
  order by called_at desc
  limit 1;

  if now_serving_num is null then
    now_serving_num := 'None';
  end if;

  -- Get waiting count
  select count(*) into waiting_count
  from public.tickets
  where status = 'waiting' and (assigned_svc is null or service_id = assigned_svc);

  -- Dynamic stateless triggers: If called in last 8 seconds, alert active
  if last_call_time is not null and now() - last_call_time < interval '8 seconds' then
    buzzer_flag := true;
    led_flag := 'green';
  else
    buzzer_flag := false;
    led_flag := 'none';
  end if;

  return json_build_object(
    'lcd_line1', 'Serving: ' || now_serving_num,
    'lcd_line2', 'Waiting: ' || waiting_count,
    'alert_beep', buzzer_flag,
    'alert_led', led_flag
  );
end;
$$ language plpgsql security definer;

-- Function for ESP32 heartbeats
create or replace function public.ping_esp32(
  counter_id_param integer,
  ip_address_param text
)
returns json as $$
begin
  insert into public.esp32_pings (id, last_ping_at, ip_address)
  values (counter_id_param, now(), ip_address_param)
  on conflict (id) do update
  set last_ping_at = now(), ip_address = ip_address_param;

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

-- Function to Reset the queue
create or replace function public.reset_queue()
returns json as $$
begin
  update public.tickets
  set status = 'cancelled', completed_at = now()
  where status in ('waiting', 'serving');

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

-- Enable Realtime for dynamic board updates
alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.counters;
alter publication supabase_realtime add table public.announcements;
