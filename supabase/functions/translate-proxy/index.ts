// CQP TOULOUSE — translate-proxy (traduction vers le français, non utilisé par le site actuellement)
// Réservé aux membres connectés. Clé dans le secret Supabase HF_API_KEY.
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
const MODELS: Record<string, string> = {
  ar: 'Helsinki-NLP/opus-mt-ar-fr',
  en: 'Helsinki-NLP/opus-mt-en-fr',
  es: 'Helsinki-NLP/opus-mt-es-fr',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (!(await allowed(req, false))) return json({ error: 'Connecte-toi pour traduire' }, 401)
  try {
    const body = await req.json()
    const model = MODELS[body.lang] || MODELS.ar
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HF_KEY}`, 'Content-Type': 'application/json', 'X-Wait-For-Model': 'true' },
      body: JSON.stringify({ inputs: String(body.text || '').slice(0, 2000) }),
    })
    if (!res.ok) return json({ error: await res.text() }, res.status)

    const data = await res.json()
    return json({ translated: Array.isArray(data) ? data[0].translation_text : data.translation_text })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
