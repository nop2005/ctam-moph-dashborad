import "https://deno.land/x/xhr@0.1.0/mod.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { health_region_id } = await req.json();

    // Get all health offices in the health region
    const { data: healthOffices, error: healthOfficesError } = await supabase
      .from("health_offices")
      .select("id, code, name, province_id, health_region_id")
      .eq("health_region_id", health_region_id)
      .order("code");

    if (healthOfficesError) {
      throw new Error(`Failed to fetch health offices: ${healthOfficesError.message}`);
    }

    console.log(`Found ${healthOffices?.length || 0} health offices in region`);

    const results = [];

    for (const office of healthOffices || []) {
      const email = `${office.code}@ctam.moph`;
      const password = office.code;

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .single();

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

      // Update profile with health_office_id, province_id, health_region_id, role, and is_active = false
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          health_office_id: office.id,
          province_id: office.province_id,
          health_region_id: office.health_region_id,
          role: "health_office",
          is_active: false,
          full_name: `ผู้ใช้ ${office.name}`,
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
        password, // Include password in results for admin reference
        status: "success",
        message: "User created successfully (pending approval)",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_offices: healthOffices?.length || 0,
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
