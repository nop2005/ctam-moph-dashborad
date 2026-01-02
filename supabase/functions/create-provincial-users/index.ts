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
    
    // Verify the request is from an authenticated user
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
    
    // Get user's profile to check role and health_region_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, health_region_id")
      .eq("user_id", user.id)
      .single();
    
    console.log("Profile lookup:", profile, profileError);
    
    // Allow both central_admin and regional users
    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: "Profile not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const isCentralAdmin = profile.role === "central_admin";
    const isRegional = profile.role === "regional";

    if (!isCentralAdmin && !isRegional) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: central_admin or regional role required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const { health_region_id } = await req.json();

    // For regional users, verify they can only create for their own region
    if (isRegional && profile.health_region_id !== health_region_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Can only create users for your own health region" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Get all provinces in the health region
    const { data: provinces, error: provincesError } = await supabase
      .from("provinces")
      .select("id, code, name")
      .eq("health_region_id", health_region_id)
      .order("code");

    if (provincesError) {
      throw new Error(`Failed to fetch provinces: ${provincesError.message}`);
    }

    console.log(`Found ${provinces?.length || 0} provinces in region ${health_region_id}`);

    const results = [];

    for (const province of provinces || []) {
      const email = `provincial.${province.code}@ctam.moph`;
      const password = `prov${province.code}`;

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .single();

      if (existingProfile) {
        results.push({
          province_code: province.code,
          province_name: province.name,
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
          province_code: province.code,
          province_name: province.name,
          status: "error",
          message: authError.message,
        });
        continue;
      }

      // Update profile with province_id, role, and is_active = false
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          province_id: province.id,
          role: "provincial",
          is_active: false, // Require approval
          full_name: `ผู้ประเมิน ${province.name}`,
        })
        .eq("user_id", authData.user.id);

      if (updateError) {
        results.push({
          province_code: province.code,
          province_name: province.name,
          status: "partial",
          message: `User created but profile update failed: ${updateError.message}`,
        });
        continue;
      }

      results.push({
        province_code: province.code,
        province_name: province.name,
        email,
        status: "success",
        message: "User created successfully (pending approval)",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_provinces: provinces?.length || 0,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in create-provincial-users:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
