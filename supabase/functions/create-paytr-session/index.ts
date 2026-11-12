import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { items, total_amount, customer_name, customer_email, customer_phone } = await req.json()

    const merchant_id = Deno.env.get('PAYTR_MERCHANT_ID')
    const merchant_key = Deno.env.get('PAYTR_MERCHANT_KEY')
    const merchant_salt = Deno.env.get('PAYTR_MERCHANT_SALT')

    if (!merchant_id || !merchant_key || !merchant_salt) {
      throw new Error('PayTR credentials are missing.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Create order in Supabase
    const merchant_oid = 'BRX_' + Date.now() + Math.floor(Math.random() * 1000)
    
    // Calculate subscription duration for fallback, or detail each item
    const subscription_duration = items[0]?.duration || 1

    const { error: dbError } = await supabase.from('orders').insert([{
      id: crypto.randomUUID(),
      merchant_oid: merchant_oid,
      total_amount: total_amount,
      items: items,
      subscription_duration: subscription_duration,
      status: 'pending_payment',
      customer_name,
      customer_email,
      customer_phone
    }])

    if (dbError) throw new Error('Database error: ' + dbError.message)

    // 2. Prepare PayTR payload
    const user_ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
    const payment_amount = Math.round(total_amount * 100) // in kurus
    
    // Basket format: [['Item Name', 'Price', int Quantity], ...]
    const user_basket = items.map((item: any) => [
      `${item.name} (${item.durationLabel || '1 GÜN'})`,
      item.price.toString(),
      item.quantity
    ])
    const user_basket_json = JSON.stringify(user_basket)

    const no_installment = 1 // 1 indicates no installment
    const max_installment = 0
    const currency = 'TL'
    const test_mode = 1 // 1 for test, 0 for prod
    
    // URL for redirect after payment process inside iframe finishes
    const merchant_ok_url = 'https://brx.site/payment/success'
    const merchant_fail_url = 'https://brx.site/payment/fail'
    const timeout_limit = 30
    const debug_on = 1
    const lang = 'tr'

    const hash_str = merchant_id + user_ip + merchant_oid + customer_email + payment_amount + user_basket_json + no_installment + max_installment + currency + test_mode

    // HMAC SHA256 Hash
    const encoder = new TextEncoder()
    const keyData = encoder.encode(merchant_key)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const dataToSign = encoder.encode(hash_str + merchant_salt)
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign)
    
    // Base64 Encode
    const paytr_token = base64Encode(signatureBuffer)

    // Send payload to PayTR to get the actual iframe token
    const formData = new URLSearchParams()
    formData.append('merchant_id', merchant_id)
    formData.append('user_ip', user_ip)
    formData.append('merchant_oid', merchant_oid)
    formData.append('email', customer_email)
    formData.append('payment_amount', payment_amount.toString())
    formData.append('paytr_token', paytr_token)
    formData.append('user_basket', user_basket_json)
    formData.append('debug_on', debug_on.toString())
    formData.append('no_installment', no_installment.toString())
    formData.append('max_installment', max_installment.toString())
    formData.append('user_name', customer_name)
    formData.append('user_address', 'Digital Delivery')
    formData.append('user_phone', customer_phone)
    formData.append('merchant_ok_url', merchant_ok_url)
    formData.append('merchant_fail_url', merchant_fail_url)
    formData.append('timeout_limit', timeout_limit.toString())
    formData.append('currency', currency)
    formData.append('test_mode', test_mode.toString())
    formData.append('lang', lang)

    const paytrResponse = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    const paytrResult = await paytrResponse.json()

    if (paytrResult.status === 'success') {
      return new Response(JSON.stringify({ token: paytrResult.token, merchant_oid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      throw new Error(paytrResult.reason)
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
