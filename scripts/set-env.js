const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://tnlxzzjxqourhjvunuxi.supabase.co';
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHh6emp4cW91cmhqdnVudXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDI4OTYsImV4cCI6MjA4OTA3ODg5Nn0.2XmejeUrjaHRLh7Ma-b0eiwwG4TAvbkb-LJa1IiR4os';

const envContent = `export const environment = {
  production: false,
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
};
`;

const prodContent = `export const environment = {
  production: true,
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
};
`;

const envDir = path.join(__dirname, '..', 'src', 'environments');
fs.mkdirSync(envDir, { recursive: true });
fs.writeFileSync(path.join(envDir, 'environment.ts'), envContent);
fs.writeFileSync(path.join(envDir, 'environment.prod.ts'), prodContent);
console.log('Environment files written.');
