import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

serve(async (req) => {
  // PayTR sends application/x-www-form-urlencoded
  const formData = await req.formData()
  const merchant_oid = formData.get('merchant_oid') as string
  const status = formData.get('status') as string
  const total_amount = formData.get('total_amount') as string
  const hash = formData.get('hash') as string
  const failed_reason_code = formData.get('failed_reason_code') as string
  const failed_reason_msg = formData.get('failed_reason_msg') as string

  const merchant_key = Deno.env.get('PAYTR_MERCHANT_KEY')
  const merchant_salt = Deno.env.get('PAYTR_MERCHANT_SALT')

  if (!merchant_key || !merchant_salt) {
    return new Response('Credentials missing', { status: 500 })
  }

  // Verify hash
  // Base64(HMAC_SHA256( merchant_oid + merchant_salt + status + total_amount, merchant_key ))
  const hash_str = merchant_oid + merchant_salt + status + total_amount

  const encoder = new TextEncoder()
  const keyData = encoder.encode(merchant_key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const dataToSign = encoder.encode(hash_str)
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign)
  const calculated_hash = base64Encode(signatureBuffer)

  if (calculated_hash !== hash) {
    // Hash mismatch, fraudulent request
    return new Response('Hash Error', { status: 400 })
  }

  // Hash valid, update database
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  if (status === 'success') {
    await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('merchant_oid', merchant_oid)
  } else {
    await supabase
      .from('orders')
      .update({ status: `failed - ${failed_reason_msg}` })
      .eq('merchant_oid', merchant_oid)
  }

  // Must return "OK" to PayTR
  return new Response('OK', { status: 200 })
})
