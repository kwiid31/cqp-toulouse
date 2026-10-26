// CQP TOULOUSE — nettoyage-medias
// Supprime les fichiers de stories de plus de 7 jours (elles ne s'affichent que 24 h)
// pour rester sous le 1 Go gratuit. Appelée chaque nuit par pg_cron.
// Sans danger si quelqu'un d'autre l'appelle : elle ne touche qu'aux vieilles stories.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

Deno.serve(async () => {
  try {
    const { data: names, error } = await sb.rpc('medias_stories_expirees')
    if (error) throw error
    let supprimes = 0
    for (let i = 0; i < (names?.length || 0); i += 100) {
      const lot = names.slice(i, i + 100)
      const { error: e } = await sb.storage.from('medias').remove(lot)
      if (e) throw e
      supprimes += lot.length
    }
    return new Response(JSON.stringify({ ok: true, supprimes }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
