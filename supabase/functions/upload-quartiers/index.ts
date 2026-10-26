// CQP TOULOUSE — upload-quartiers (photos des quartiers, upload-quartiers.html)
// Réservé aux admins : écrit dans le bucket « quartiers » avec la clé service.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (!(await allowed(req, true))) return json({ error: 'Réservé aux admins' }, 403)
  try {
    const { name, b64, mime } = await req.json()
    if (!/^[a-z0-9_-]{1,60}$/i.test(name || '')) return json({ error: 'Nom de fichier invalide' }, 400)
    if (mime !== 'image/png' && mime !== 'image/jpeg') return json({ error: 'Image PNG ou JPEG uniquement' }, 400)

    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const path = `${name}.${mime === 'image/png' ? 'png' : 'jpg'}`
    const { error } = await sb.storage.from('quartiers').upload(path, new Blob([bytes], { type: mime }), {
      contentType: mime,
      upsert: true,
    })
    if (error) throw error

    const { data } = sb.storage.from('quartiers').getPublicUrl(path)
    return json({ url: data.publicUrl })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
