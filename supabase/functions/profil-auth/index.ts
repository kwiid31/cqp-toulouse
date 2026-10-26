// CQP TOULOUSE — profil-auth
// Crée les comptes membres (code public + clé secrète) côté serveur.
//   signup : nouveau profil → { code, cle }
//   claim  : profil existant pas encore protégé → { cle } (période de transition)
//   reset  : un admin génère une nouvelle clé pour un membre → { cle }
// La clé secrète n'est jamais stockée en clair : c'est le mot de passe Supabase Auth.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const DOMAIN = 'membres.cqp-toulouse.fr'
const CLAIM_UNTIL = new Date('2027-01-31T23:59:59Z')
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sans 0/O, 1/I/L

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const emailFor = (code: string) => `${code}@${DOMAIN}`

function newCle(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

async function newCode(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000))
    const { data } = await sb.from('profils').select('id').eq('code', code).maybeSingle()
    if (!data) return code
  }
  throw new Error('Impossible de générer un code')
}

// Crée le compte Auth du code, ou remplace son mot de passe s'il existe déjà
async function upsertAuthUser(code: string, cle: string): Promise<string> {
  const email = emailFor(code)
  const { data, error } = await sb.auth.admin.createUser({ email, password: cle, email_confirm: true })
  if (!error && data.user) return data.user.id
  for (let page = 1; page < 20; page++) {
    const { data: list } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    const u = list?.users.find(x => x.email === email)
    if (u) {
      await sb.auth.admin.updateUserById(u.id, { password: cle })
      return u.id
    }
    if (!list || list.users.length < 1000) break
  }
  throw new Error('Création du compte impossible')
}

async function callerProfil(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return null
  const { data } = await sb.from('profils').select('code, is_admin').eq('user_id', user.id).maybeSingle()
  return data
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action

    if (action === 'signup') {
      const prenom = String(body.prenom || '').trim().slice(0, 40)
      if (!prenom) return json({ error: 'Prénom obligatoire' }, 400)
      const code = await newCode()
      const cle = newCle()
      const user_id = await upsertAuthUser(code, cle)
      const { error } = await sb.from('profils').insert({
        code, session_id: code, user_id, prenom,
        quartier: String(body.quartier || '').trim().slice(0, 60) || null,
        bio: String(body.bio || '').trim().slice(0, 300) || null,
        email: String(body.email || '').trim().toLowerCase().slice(0, 120) || null,
        is_admin: false,
      })
      if (error) {
        await sb.auth.admin.deleteUser(user_id)
        throw error
      }
      return json({ code, cle, email: emailFor(code) })
    }

    if (action === 'claim') {
      if (new Date() > CLAIM_UNTIL) return json({ error: 'Période de transition terminée. Demande une nouvelle clé à un admin.' }, 403)
      const code = String(body.code || '')
      if (!/^\d{6}$/.test(code)) return json({ error: 'Code invalide' }, 400)
      const { data: p } = await sb.from('profils').select('id, user_id').eq('code', code).maybeSingle()
      if (!p) return json({ error: 'Code introuvable' }, 404)
      if (p.user_id) return json({ error: 'Ce profil est déjà protégé par une clé secrète.' }, 409)
      const cle = newCle()
      const user_id = await upsertAuthUser(code, cle)
      // Seul le premier appareil gagne : on ne lie que si personne ne l'a fait entre-temps
      const { data: linked } = await sb.from('profils').update({ user_id }).eq('id', p.id).is('user_id', null).select('id')
      if (!linked?.length) return json({ error: 'Ce profil est déjà protégé par une clé secrète.' }, 409)
      return json({ cle, email: emailFor(code) })
    }

    if (action === 'reset') {
      const caller = await callerProfil(req)
      if (!caller?.is_admin) return json({ error: 'Réservé aux admins' }, 403)
      const code = String(body.code || '')
      const { data: p } = await sb.from('profils').select('id').eq('code', code).maybeSingle()
      if (!p) return json({ error: 'Code introuvable' }, 404)
      const cle = newCle()
      const user_id = await upsertAuthUser(code, cle)
      await sb.from('profils').update({ user_id }).eq('id', p.id)
      return json({ cle })
    }

    return json({ error: 'Action inconnue' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: 'Erreur serveur' }, 500)
  }
})
