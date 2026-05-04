import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { profil_code, action } = await req.json();

    if (!profil_code) {
      return new Response(JSON.stringify({ error: "profil_code required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Email/password dérivés du code (stable et prévisible)
    const email = `code-${profil_code}@cqp-toulouse.fr`;
    const password = `cqp-${profil_code}-secret2025`;

    if (action === "signup") {
      // Créer le compte Supabase Auth
      const { data, error } = await sb.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error && !error.message.includes("already")) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ email, password }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === "login" : vérifier que le code existe en base
    const { data: profil } = await sb.from("profils").select("code").eq("code", profil_code).limit(1);
    if (!profil?.length) {
      return new Response(JSON.stringify({ error: "Code introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ email, password }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
