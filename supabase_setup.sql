-- ============================================
-- Centralux Barcode - Script SQL Completo
-- Executar no SQL Editor do Supabase
-- ============================================

-- Habilitar extensão UUID (geralmente já habilitada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: items
-- Armazena os itens/produtos cadastrados
-- ============================================
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, code)
);

-- ============================================
-- TABELA: barcodes
-- Vincula códigos de barras aos itens
-- ============================================
CREATE TABLE IF NOT EXISTS barcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    barcode_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, barcode_value)
);

-- ============================================
-- TABELA: scan_logs
-- Registra cada leitura de barcode
-- ============================================
CREATE TABLE IF NOT EXISTS scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode_id UUID NOT NULL REFERENCES barcodes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- ============================================
-- ÍNDICES para performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);
CREATE INDEX IF NOT EXISTS idx_barcodes_user_id ON barcodes(user_id);
CREATE INDEX IF NOT EXISTS idx_barcodes_value ON barcodes(barcode_value);
CREATE INDEX IF NOT EXISTS idx_barcodes_item_id ON barcodes(item_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_user_id ON scan_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at ON scan_logs(scanned_at);
CREATE INDEX IF NOT EXISTS idx_scan_logs_item_id ON scan_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_barcode_id ON scan_logs(barcode_id);

-- ============================================
-- HABILITAR RLS (Row Level Security)
-- ============================================
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS - items
-- Cada usuário só vê/modifica seus próprios itens
-- ============================================
CREATE POLICY "Usuários podem ver seus próprios itens"
    ON items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios itens"
    ON items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios itens"
    ON items FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seus próprios itens"
    ON items FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- POLÍTICAS RLS - barcodes
-- ============================================
CREATE POLICY "Usuários podem ver seus próprios barcodes"
    ON barcodes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios barcodes"
    ON barcodes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios barcodes"
    ON barcodes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seus próprios barcodes"
    ON barcodes FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- POLÍTICAS RLS - scan_logs
-- ============================================
CREATE POLICY "Usuários podem ver seus próprios logs"
    ON scan_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios logs"
    ON scan_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seus próprios logs"
    ON scan_logs FOR DELETE
    USING (auth.uid() = user_id);
