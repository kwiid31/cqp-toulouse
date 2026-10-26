// CQP TOULOUSE — groq-proxy (assistante IA « Leila », ia.html / ia2.html)
// Réservé aux membres connectés. Clé dans le secret Supabase GROQ_API_KEY.
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

const GROQ_KEY = Deno.env.get('GROQ_API_KEY') || ''
const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'meta-llama/llama-4-scout-17b-16e-instruct']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (!(await allowed(req, false))) return json({ error: 'Connecte-toi pour utiliser l\'IA' }, 401)
  try {
    const body = await req.json()
    if (!MODELS.includes(body.model)) body.model = MODELS[0]
    body.max_tokens = Math.min(Number(body.max_tokens) || 800, 1500)
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return new Response(res.body, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
