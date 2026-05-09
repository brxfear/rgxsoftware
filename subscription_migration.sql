-- ============================================
-- ABONELİK SİSTEMİ İÇİN SUPABASE SQL KOMUTLARI
-- Supabase SQL Editor'e gidip bunları çalıştır
-- ============================================

-- 1. Products tablosuna yeni fiyat sütunları ekle
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_1day NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_7day NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_30day NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_lifetime NUMERIC(10, 2) DEFAULT 0;

-- Mevcut price değerlerini price_1day'e kopyala (eğer varsa)
UPDATE products SET price_1day = price WHERE price_1day = 0 AND price > 0;

-- 2. Orders tablosuna subscription_duration sütunu ekle (bu sütunu artık doğrudan kullanmıyoruz ama uyumluluk için kalabilir)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subscription_duration INTEGER DEFAULT 1;

-- 3. Cart Items tablosuna süre ve fiyat bilgisini ekle
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 1;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS duration_label TEXT DEFAULT '1 GÜN';
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_price NUMERIC(10, 2) DEFAULT 0;
