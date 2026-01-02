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
      .select("role, province_id")
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

    // Get all hospitals in the provincial admin's province
    const { data: hospitals, error: hospitalsError } = await supabase
      .from("hospitals")
      .select("id, code, name")
      .eq("province_id", province_id)
      .order("code");

    if (hospitalsError) {
      throw new Error(`Failed to fetch hospitals: ${hospitalsError.message}`);
    }

    console.log(`Found ${hospitals.length} hospitals in province ${province_id}`);

    const results = [];

    for (const hospital of hospitals) {
      const email = `${hospital.code}@ctam.moph`;
      const password = hospital.code;

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .single();

      if (existingProfile) {
        results.push({
          hospital_code: hospital.code,
          hospital_name: hospital.name,
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
          hospital_code: hospital.code,
          hospital_name: hospital.name,
          status: "error",
          message: authError.message,
        });
        continue;
      }

      // Update profile with hospital_id, province_id, role, and is_active = false
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          hospital_id: hospital.id,
          province_id: province_id,
          role: "hospital_it",
          is_active: false,
          full_name: `IT ${hospital.name}`,
        })
        .eq("user_id", authData.user.id);

      if (updateError) {
        results.push({
          hospital_code: hospital.code,
          hospital_name: hospital.name,
          status: "partial",
          message: `User created but profile update failed: ${updateError.message}`,
        });
        continue;
      }

      results.push({
        hospital_code: hospital.code,
        hospital_name: hospital.name,
        email,
        status: "success",
        message: "User created successfully (pending approval)",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_hospitals: hospitals.length,
        results,
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
