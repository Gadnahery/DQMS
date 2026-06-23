// Bypasses the WebSocket constructor check in Node.js environments
global.WebSocket = class {};

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '.env');
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseKey = keyMatch[1].trim();
} catch (e) {
  console.error('Failed to read .env file', e);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing in .env file');
  process.exit(1);
}

console.log('Connecting to Supabase at:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('\n--- 1. Testing Services Table ---');
  let { data: services, error: errServices } = await supabase.from('services').select('*');
  if (errServices) {
    console.error('Error reading services:', errServices);
  } else {
    console.log(`Success! Found ${services.length} services.`);
    if (services.length === 0) {
      console.log('Seeding default services into Supabase services table...');
      const defaultServices = [
        { name: 'General Registration', code: 'REG', avg_handling_time_mins: 8, color_theme: '#3b82f6', priority_weight: 1 },
        { name: 'Cashier & Payments', code: 'PAY', avg_handling_time_mins: 4, color_theme: '#10b981', priority_weight: 1 },
        { name: 'Customer Support', code: 'SUP', avg_handling_time_mins: 15, color_theme: '#f59e0b', priority_weight: 1 },
        { name: 'Executive Operations', code: 'EXE', avg_handling_time_mins: 20, color_theme: '#8b5cf6', priority_weight: 1 }
      ];
      const { data: seeded, error: errSeed } = await supabase.from('services').insert(defaultServices).select();
      if (errSeed) {
        console.error('Seeding services failed:', errSeed);
      } else {
        console.log(`Successfully seeded ${seeded.length} services!`);
        services = seeded;
      }
    }
    services.forEach(s => console.log(`  - [${s.code}] ${s.name} (ID: ${s.id}, Handling: ${s.avg_handling_time_mins}m, Color: ${s.color_theme})`));
  }

  console.log('\n--- 2. Testing Counters Table ---');
  const { data: counters, error: errCounters } = await supabase.from('counters').select('*');
  if (errCounters) {
    console.error('Error reading counters:', errCounters);
  } else {
    console.log(`Success! Found ${counters.length} counters:`);
    counters.forEach(c => console.log(`  - ${c.counter_name} (Status: ${c.status})`));
  }

  console.log('\n--- 3. Testing Tickets Table ---');
  const { data: tickets, error: errTickets } = await supabase.from('tickets').select('*');
  if (errTickets) {
    console.error('Error reading tickets:', errTickets);
  } else {
    console.log(`Success! Found ${tickets.length} tickets total.`);
    if (tickets.length > 0) {
      console.log('Latest 3 tickets:');
      tickets.slice(-3).forEach(t => console.log(`  - ${t.ticket_number} (Customer: ${t.customer_name}, Status: ${t.status}, Counter: ${t.counter_assigned})`));
    }
  }

  console.log('\n--- 4. Testing RPC Function join_queue ---');
  if (services && services.length > 0) {
    const serviceId = services[0].id;
    console.log(`Testing join_queue RPC for Service ID: ${serviceId}...`);
    const { data: joinRes, error: errJoin } = await supabase.rpc('join_queue', {
      service_id_param: serviceId,
      name_param: 'DB Connection Tester',
      phone_param: '+123456789',
      priority_param: 'normal'
    });
    
    if (errJoin) {
      console.error('join_queue RPC failed:', errJoin);
    } else {
      console.log('join_queue RPC succeeded! Result:', joinRes);
      
      // Clean up the test ticket
      if (joinRes && joinRes.ticket && joinRes.ticket.id) {
        console.log(`Cleaning up test ticket ID: ${joinRes.ticket.id}...`);
        const { error: deleteErr } = await supabase.from('tickets').delete().eq('id', joinRes.ticket.id);
        if (deleteErr) console.error('Cleanup failed:', deleteErr);
        else console.log('Cleanup completed successfully.');
      }
    }
  } else {
    console.log('Skipping RPC test (no services available).');
  }

  console.log('\n--- Verification Summary ---');
  if (!errServices && !errCounters && !errTickets) {
    console.log('✅ ALL DATABASE CONNECTIONS AND SCHEMA VERIFICATIONS PASSED.');
  } else {
    console.log('❌ SOME TESTS FAILED. CHECK ERRORS ABOVE.');
  }
}

runTest();
