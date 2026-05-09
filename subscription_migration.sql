-- ============================================
-- ABONELİK SİSTEMİ İÇİN SUPABASE SQL KOMUTLARI
-- Supabase SQL Editor'e gidip bunları çalıştır
-- ============================================

-- 1. Products tablosuna yeni fiyat sütunları ekle
ALTER TABLE products ADD COLUMN IF NOT EXISTS daily_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weekly_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10, 2) DEFAULT 0;

-- Mevcut price değerlerini daily_price'a kopyala (eğer varsa)
UPDATE products SET daily_price = price WHERE daily_price = 0 AND price > 0;

-- 2. Orders tablosuna subscription_duration sütunu ekle
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subscription_duration INTEGER DEFAULT 1;
