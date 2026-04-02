// ============================================
// Centralux Barcode — Cliente Supabase
// Configuração centralizada do Supabase
// ============================================

// Configuração do Supabase
// Estes valores serão substituídos pelo GitHub Actions durante o deploy
// Para desenvolvimento local, use os valores padrão abaixo
const SUPABASE_URL = '%%SUPABASE_URL%%' !== '%%' + 'SUPABASE_URL' + '%%'
    ? '%%SUPABASE_URL%%'
    : 'https://zobzcmrppzveydjqwhig.supabase.co';

const SUPABASE_ANON_KEY = '%%SUPABASE_ANON_KEY%%' !== '%%' + 'SUPABASE_ANON_KEY' + '%%'
    ? '%%SUPABASE_ANON_KEY%%'
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvYnpjbXJwcHp2ZXlkanF3aGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjk3MTgsImV4cCI6MjA5MDcwNTcxOH0.P2KwJwLYzR1Lm68cGI0q3XMWKOr4np3Fyo0W0F9vtoI';

// Criar cliente Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Log de conexão (apenas em desenvolvimento)
console.log('🔗 Supabase conectado:', SUPABASE_URL);
