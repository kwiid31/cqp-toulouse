// Edge Function : authentification par code 6 chiffres → JWT signé
// Signe un JWT avec SUPABASE_JWT_SECRET pour les RLS policies

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { profil_code, action } = await req.json()

    if (!profil_code || !/^\d{6}$/.test(profil_code)) {
      return json({ error: 'Code invalide' }, 400)
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'login') {
      const { data, error } = await sb.from('profils').select('*').eq('code', profil_code).single()
      if (error || !data) return json({ error: 'Code introuvable' }, 404)
      const token = await signJwt(profil_code)
      return json({ token, profil: data })
    }

    if (action === 'signup') {
      const { data: existing } = await sb.from('profils').select('code').eq('code', profil_code).maybeSingle()
      if (existing) return json({ error: 'Code déjà utilisé' }, 409)
      const token = await signJwt(profil_code)
      return json({ token })
    }

    return json({ error: 'Action inconnue' }, 400)

  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function signJwt(profil_code: string): Promise<string> {
  const secret = Deno.env.get('SUPABASE_JWT_SECRET')!
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const now = Math.floor(Date.now() / 1000)
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    profil_code, role: 'authenticated', iss: 'supabase',
    iat: now, exp: now + 60 * 60 * 24 * 30   // 30 jours
  }))
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`))
  return `${header}.${payload}.${b64url(sig)}`
}

function b64url(data: string | ArrayBuffer): string {
  const str = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data))
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
