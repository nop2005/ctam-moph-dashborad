import "https://deno.land/x/xhr@0.1.0/mod.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// สำนักงานเขตสุขภาพที่ 2-12 data
const REGIONAL_OFFICES = [
  { code: "41206", health_office_id: "fdfa9c2b-4aa5-4089-b92f-e3e2c78fdc83", health_region_id: "aa68d052-0e09-462c-a9d8-ab164c3ed2cb", name: "สำนักงานเขตสุขภาพที่ 2" },
  { code: "41306", health_office_id: "7cd4d2e0-b4d5-473c-b72f-0b69a5daf31e", health_region_id: "a3e63e45-2252-43d2-8e32-67a664fb7223", name: "สำนักงานเขตสุขภาพที่ 3" },
  { code: "41406", health_office_id: "6cb06e90-8622-4634-984c-f8099e6d0f22", health_region_id: "cf43e813-52cf-4151-84eb-cf1e73b154b7", name: "สำนักงานเขตสุขภาพที่ 4" },
  { code: "41506", health_office_id: "606e2f30-0b9b-4a15-a8cd-7e42e77f1bf9", health_region_id: "d960812c-c96d-4cc1-8ab4-f5cf2eb44cb8", name: "สำนักงานเขตสุขภาพที่ 5" },
  { code: "41606", health_office_id: "bbd19599-8bd2-4868-82a3-f7883d27020b", health_region_id: "3f06527e-53b9-4c02-9d97-94798a51d04a", name: "สำนักงานเขตสุขภาพที่ 6" },
  { code: "41706", health_office_id: "5e944978-6e6d-45b5-9711-9c769ff59afb", health_region_id: "0620bf06-8eea-4ef5-9d79-ebd3e2cfed3d", name: "สำนักงานเขตสุขภาพที่ 7" },
  { code: "41806", health_office_id: "5828c576-618d-4542-bc30-ec5afbd9e2cd", health_region_id: "4fe4d2dc-cd01-4486-ba84-02d7d9bd7229", name: "สำนักงานเขตสุขภาพที่ 8" },
  { code: "41906", health_office_id: "22a96d05-ae42-4220-a67d-ab2bea338900", health_region_id: "3123915c-dfd4-4e52-885d-f75bc37cb5ff", name: "สำนักงานเขตสุขภาพที่ 9" },
  { code: "42006", health_office_id: "3f56cae9-6190-42ee-8015-c70aaa4a1dcd", health_region_id: "ac0f1aeb-5e21-4b2f-8939-73e639887f26", name: "สำนักงานเขตสุขภาพที่ 10" },
  { code: "42106", health_office_id: "19b7595e-2849-4d54-bed1-9979c31b5d4b", health_region_id: "7e47a04a-7087-47b6-80ec-73d3b4b04e8c", name: "สำนักงานเขตสุขภาพที่ 11" },
  { code: "42206", health_office_id: "75134b30-63ad-4b76-b7fd-4d51d73dd473", health_region_id: "580be37a-57ae-4d57-ae5d-2c99d7dbd25a", name: "สำนักงานเขตสุขภาพที่ 12" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create service role client for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    // Verify the request is from an authenticated user with central_admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    
    const token = authHeader.replace("Bearer ", "");
    
    // Verify user with service role client
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    
    console.log("Authenticated user:", user.id, user.email);
    
    // Verify user is central_admin using service role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    
    console.log("Profile lookup:", profile, profileError);
    
    if (profileError || profile?.role !== "central_admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: central_admin role required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    console.log(`Creating ${REGIONAL_OFFICES.length} regional office users`);

    const results = [];

    for (const office of REGIONAL_OFFICES) {
      const email = `${office.code}@ctam.moph`;
      const password = office.code;

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        results.push({
          office_code: office.code,
          office_name: office.name,
          status: "skipped",
          message: "User already exists",
        });
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        results.push({
          office_code: office.code,
          office_name: office.name,
          status: "error",
          message: authError.message,
        });
        continue;
      }

      // Update profile with health_office role and settings
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          health_office_id: office.health_office_id,
          health_region_id: office.health_region_id,
          province_id: null,
          role: "health_office",
          is_active: true, // Active immediately
          full_name: `IT ${office.name}`,
        })
        .eq("user_id", authData.user.id);

      if (updateError) {
        results.push({
          office_code: office.code,
          office_name: office.name,
          status: "partial",
          message: `User created but profile update failed: ${updateError.message}`,
        });
        continue;
      }

      results.push({
        office_code: office.code,
        office_name: office.name,
        email,
        password,
        status: "success",
        message: "User created successfully",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_offices: REGIONAL_OFFICES.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
