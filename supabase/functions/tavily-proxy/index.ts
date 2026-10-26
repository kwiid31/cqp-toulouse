// CQP TOULOUSE — tavily-proxy (recherche web pour l'IA)
// Réservé aux membres connectés. Clé dans le secret Supabase TAVILY_API_KEY.
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

const TAVILY_KEY = Deno.env.get('TAVILY_API_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (!(await allowed(req, false))) return json({ error: 'Connecte-toi pour utiliser l\'IA' }, 401)
  try {
    const body = await req.json()
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: String(body.query || '').slice(0, 400),
        max_results: Math.min(Number(body.max_results) || 4, 8),
        search_depth: 'basic',
        country: 'France',
        include_domains: body.include_domains || [],
      }),
    })
    return json(await res.json(), res.status)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
