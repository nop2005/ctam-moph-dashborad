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
    
    // Verify the request is from an authenticated user with provincial role
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
    
    // Verify user is provincial admin and get their province_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, province_id, health_region_id")
      .eq("user_id", user.id)
      .single();
    
    console.log("Profile lookup:", profile, profileError);
    
    if (profileError || profile?.role !== "provincial" || !profile?.province_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: provincial role with province_id required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const province_id = profile.province_id;

    // Get health office in the provincial admin's province
    const { data: healthOffice, error: healthOfficeError } = await supabase
      .from("health_offices")
      .select("id, code, name, health_region_id")
      .eq("province_id", province_id)
      .single();

    if (healthOfficeError || !healthOffice) {
      return new Response(
        JSON.stringify({ success: false, error: "Health office not found for this province" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    console.log(`Found health office: ${healthOffice.name} (${healthOffice.code})`);

    const email = `${healthOffice.code}@ctam.moph`;
    const password = healthOffice.code;

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, province_id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      // Update province_id if missing
      if (!existingProfile.province_id) {
        await supabase
          .from("profiles")
          .update({ province_id: province_id })
          .eq("id", existingProfile.id);
        console.log(`Updated province_id for existing user: ${email}`);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "User already exists",
          health_office_code: healthOffice.code,
          health_office_name: healthOffice.name,
          status: "skipped",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: authError.message,
          health_office_code: healthOffice.code,
          health_office_name: healthOffice.name,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Update profile with health_office_id, province_id, role, and is_active = false
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        health_office_id: healthOffice.id,
        province_id: province_id,
        health_region_id: healthOffice.health_region_id,
        role: "health_office",
        is_active: false,
        full_name: `IT ${healthOffice.name}`,
      })
      .eq("user_id", authData.user.id);

    if (updateError) {
      return new Response(
        JSON.stringify({
          success: true,
          status: "partial",
          message: `User created but profile update failed: ${updateError.message}`,
          health_office_code: healthOffice.code,
          health_office_name: healthOffice.name,
          email,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "success",
        message: "User created successfully (pending approval)",
        health_office_code: healthOffice.code,
        health_office_name: healthOffice.name,
        email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
