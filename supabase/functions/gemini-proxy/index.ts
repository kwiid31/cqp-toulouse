// CQP TOULOUSE — gemini-proxy (non utilisé par le site actuellement)
// Réservé aux admins. Clé dans le secret Supabase GEMINI_API_KEY.
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

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (!(await allowed(req, true))) return json({ error: 'Réservé aux admins' }, 403)
  try {
    const body = await req.json()
    const model = /^gemini-[\w.-]+$/.test(body.model || '') ? body.model : 'gemini-2.0-flash'
    const messages = body.messages || []

    // Convertir format OpenAI → Gemini
    const systemMsg = messages.find((m: any) => m.role === 'system')
    const contents = messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    }))
    const payload: any = {
      contents,
      generationConfig: { maxOutputTokens: Math.min(body.max_tokens || 400, 1500), temperature: body.temperature || 0.5 },
    }
    if (systemMsg) payload.systemInstruction = { parts: [{ text: systemMsg.content }] }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return json({ error: await res.text() }, res.status)

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    // Retourner format compatible OpenAI
    return json({ choices: [{ message: { role: 'assistant', content: text }, delta: { content: text } }] })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
