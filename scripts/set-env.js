const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'] || 'placeholder-anon-key';

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
