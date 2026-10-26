// CQP TOULOUSE — huggingface-proxy (génération d'image, non utilisé par le site actuellement)
// Réservé aux admins. Clé dans le secret Supabase HF_API_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Vérifie que l'appel vient d'un membre connecté (ou d'un admin si adminOnly)
async function allowed(req: Request, adminOnly: boolean): Promise<boolean> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return false
  const { data } = await sb.from('profils').select('is_admin').eq('user_id', user.id).maybeSingle()
  return !!data && (!adminOnly || data.is_admin)
}

const HF_KEY = Deno.env.get('HF_API_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (!(await allowed(req, true))) return json({ error: 'Réservé aux admins' }, 403)
  try {
    const body = await req.json()
    const prompt = String(body.prompt || 'a beautiful photo').slice(0, 500)
    const res = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HF_KEY}`, 'Content-Type': 'application/json', 'X-Wait-For-Model': 'true' },
      body: JSON.stringify({ inputs: prompt }),
    })
    if (!res.ok) return json({ error: await res.text() }, res.status)

    const bytes = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return json({ image: `data:image/png;base64,${btoa(bin)}` })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
