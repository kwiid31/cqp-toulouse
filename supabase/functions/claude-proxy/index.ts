// CQP TOULOUSE — claude-proxy (non utilisé par le site actuellement)
// Réservé aux admins (API payante). Clé dans le secret Supabase ANTHROPIC_API_KEY.
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

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (!(await allowed(req, true))) return json({ error: 'Réservé aux admins' }, 403)
  try {
    const body = await req.json()
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: body.system,
        messages: body.messages,
      }),
    })
    return json(await res.json(), res.status)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
