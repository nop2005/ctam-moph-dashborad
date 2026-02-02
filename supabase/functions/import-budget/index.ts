import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============ Fuzzy Matching Utilities ============

// Levenshtein distance calculation
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// Calculate similarity percentage
function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  return ((maxLen - distance) / maxLen) * 100;
}

// Normalize unit name for matching
function normalizeUnitName(name: string): string {
  let normalized = name.trim();

  // Replace common abbreviations
  const replacements: [RegExp, string][] = [
    [/^สสจ\.?\s*/i, "สำนักงานสาธารณสุขจังหวัด"],
    [/^สสอ\.?\s*/i, "สำนักงานสาธารณสุขอำเภอ"],
    [/^รพท\.?\s*/i, "โรงพยาบาลทั่วไป"],
    [/^รพศ\.?\s*/i, "โรงพยาบาลศูนย์"],
    [/^รพช\.?\s*/i, "โรงพยาบาลชุมชน"],
    [/^รพ\.?\s*/i, "รพ."],
    [/^สนง\.?เขต\s*/i, "สำนักงานเขตสุขภาพที่"],
    [/^สบส\.?\s*/i, "สำนักงานสนับสนุนบริการสุขภาพ"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement);
      break;
    }
  }

  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

// Province to region mapping (for สนง.เขต matching)
const provinceToRegion: Record<string, number> = {
  เชียงใหม่: 1,
  เชียงราย: 1,
  ลำปาง: 1,
  ลำพูน: 1,
  แม่ฮ่องสอน: 1,
  น่าน: 1,
  พะเยา: 1,
  แพร่: 1,
  ตาก: 2,
  พิษณุโลก: 2,
  เพชรบูรณ์: 2,
  สุโขทัย: 2,
  อุตรดิตถ์: 2,
  นครสวรรค์: 3,
  อุทัยธานี: 3,
  กำแพงเพชร: 3,
  พิจิตร: 3,
  ชัยนาท: 3,
  สระบุรี: 4,
  ลพบุรี: 4,
  สิงห์บุรี: 4,
  อ่างทอง: 4,
  นนทบุรี: 4,
  ปทุมธานี: 4,
  พระนครศรีอยุธยา: 4,
  นครนายก: 4,
  ราชบุรี: 5,
  กาญจนบุรี: 5,
  สุพรรณบุรี: 5,
  นครปฐม: 5,
  สมุทรสงคราม: 5,
  สมุทรสาคร: 5,
  เพชรบุรี: 5,
  ประจวบคีรีขันธ์: 5,
  ระยอง: 6,
  จันทบุรี: 6,
  ตราด: 6,
  ชลบุรี: 6,
  ฉะเชิงเทรา: 6,
  ปราจีนบุรี: 6,
  สระแก้ว: 6,
  สมุทรปราการ: 6,
  ขอนแก่น: 7,
  กาฬสินธุ์: 7,
  ร้อยเอ็ด: 7,
  มหาสารคาม: 7,
  อุดรธานี: 8,
  หนองคาย: 8,
  เลย: 8,
  หนองบัวลำภู: 8,
  สกลนคร: 8,
  นครพนม: 8,
  บึงกาฬ: 8,
  นครราชสีมา: 9,
  ชัยภูมิ: 9,
  บุรีรัมย์: 9,
  สุรินทร์: 9,
  อุบลราชธานี: 10,
  ยโสธร: 10,
  ศรีสะเกษ: 10,
  อำนาจเจริญ: 10,
  มุกดาหาร: 10,
  สุราษฎร์ธานี: 11,
  ชุมพร: 11,
  ระนอง: 11,
  กระบี่: 11,
  พังงา: 11,
  ภูเก็ต: 11,
  นครศรีธรรมราช: 11,
  สงขลา: 12,
  สตูล: 12,
  ตรัง: 12,
  พัทลุง: 12,
  ปัตตานี: 12,
  ยะลา: 12,
  นราธิวาส: 12,
  กรุงเทพมหานคร: 13,
};

interface UnitData {
  id: string;
  name: string;
  type: "hospital" | "health_office";
  province_id: string | null;
  health_region_id?: string | null;
}

interface BudgetImportRow {
  unit_name: string;
  province: string;
  budgets: Record<string, number>;
}

interface MatchResult {
  unit_name: string;
  matched_to: string | null;
  matched_id: string | null;
  matched_type: "hospital" | "health_office" | null;
  similarity: number;
  status: "exact" | "fuzzy" | "unmatched";
}

// Find best match for a unit name
function findBestMatch(
  unitName: string,
  provinceName: string,
  allUnits: UnitData[],
  provinces: { id: string; name: string }[]
): MatchResult {
  const normalized = normalizeUnitName(unitName);

  // Find province ID for validation
  const province = provinces.find(
    (p) => p.name === provinceName || p.name.includes(provinceName) || provinceName.includes(p.name)
  );

  // Step 1: Try exact match
  for (const unit of allUnits) {
    const normalizedDbName = normalizeUnitName(unit.name);
    if (normalized === normalizedDbName || unit.name === unitName) {
      return {
        unit_name: unitName,
        matched_to: unit.name,
        matched_id: unit.id,
        matched_type: unit.type,
        similarity: 100,
        status: "exact",
      };
    }
  }

  // Step 2: Filter units by province if possible
  let candidateUnits = allUnits;
  if (province) {
    const unitsInProvince = allUnits.filter((u) => u.province_id === province.id);
    if (unitsInProvince.length > 0) {
      candidateUnits = unitsInProvince;
    }
  }

  // Step 3: Fuzzy match
  let bestMatch: UnitData | null = null;
  let bestSimilarity = 0;

  for (const unit of candidateUnits) {
    const normalizedDbName = normalizeUnitName(unit.name);
    const similarity = calculateSimilarity(normalized, normalizedDbName);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = unit;
    }
  }

  // Threshold: 70% similarity
  if (bestMatch && bestSimilarity >= 70) {
    return {
      unit_name: unitName,
      matched_to: bestMatch.name,
      matched_id: bestMatch.id,
      matched_type: bestMatch.type,
      similarity: Math.round(bestSimilarity * 10) / 10,
      status: "fuzzy",
    };
  }

  // Step 4: Try matching without province filter if no good match found
  if (province && bestSimilarity < 70) {
    for (const unit of allUnits) {
      const normalizedDbName = normalizeUnitName(unit.name);
      const similarity = calculateSimilarity(normalized, normalizedDbName);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = unit;
      }
    }

    if (bestMatch && bestSimilarity >= 70) {
      return {
        unit_name: unitName,
        matched_to: bestMatch.name,
        matched_id: bestMatch.id,
        matched_type: bestMatch.type,
        similarity: Math.round(bestSimilarity * 10) / 10,
        status: "fuzzy",
      };
    }
  }

  return {
    unit_name: unitName,
    matched_to: null,
    matched_id: null,
    matched_type: null,
    similarity: bestSimilarity,
    status: "unmatched",
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["central_admin", "regional"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { fiscal_year, data, mode = "preview" } = body as {
      fiscal_year: number;
      data: BudgetImportRow[];
      mode: "preview" | "import";
    };

    if (!fiscal_year || !data || !Array.isArray(data)) {
      return new Response(
        JSON.stringify({ error: "Invalid request body. Required: fiscal_year, data[]" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing ${data.length} rows for fiscal year ${fiscal_year}, mode: ${mode}`);

    // Fetch reference data
    const [hospitalsRes, healthOfficesRes, provincesRes, categoriesRes] = await Promise.all([
      supabase.from("hospitals").select("id, name, province_id"),
      supabase.from("health_offices").select("id, name, province_id, health_region_id"),
      supabase.from("provinces").select("id, name"),
      supabase.from("ctam_categories").select("id, code"),
    ]);

    const hospitals = hospitalsRes.data || [];
    const healthOffices = healthOfficesRes.data || [];
    const provinces = provincesRes.data || [];
    const categories = categoriesRes.data || [];

    // Build category order_number to ID map (1-17)
    const categoryByOrder = new Map(categories.map((c: { id: string; code: string; order_number?: number }) => {
      // Get order from the database order_number field
      return [(c as { order_number: number }).order_number, c.id];
    }));
    
    // Also build code to ID map for reference
    const categoryByCode = new Map(categories.map((c: { id: string; code: string }) => [c.code, c.id]));

    // Combine all units for matching
    const allUnits: UnitData[] = [
      ...hospitals.map((h: { id: string; name: string; province_id: string }) => ({
        id: h.id,
        name: h.name,
        type: "hospital" as const,
        province_id: h.province_id,
      })),
      ...healthOffices.map((o: { id: string; name: string; province_id: string | null; health_region_id: string }) => ({
        id: o.id,
        name: o.name,
        type: "health_office" as const,
        province_id: o.province_id,
        health_region_id: o.health_region_id,
      })),
    ];

    // Match each row
    const matchResults: MatchResult[] = [];
    for (const row of data) {
      const result = findBestMatch(row.unit_name, row.province, allUnits, provinces);
      matchResults.push(result);
    }

    // Preview mode: just return match results
    if (mode === "preview") {
      const summary = {
        total: matchResults.length,
        exact: matchResults.filter((r) => r.status === "exact").length,
        fuzzy: matchResults.filter((r) => r.status === "fuzzy").length,
        unmatched: matchResults.filter((r) => r.status === "unmatched").length,
      };

      console.log(`Preview complete: ${JSON.stringify(summary)}`);

      return new Response(
        JSON.stringify({
          success: true,
          mode: "preview",
          summary,
          matches: matchResults,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Import mode: insert/update records
    const importResults = {
      success: 0,
      failed: 0,
      errors: [] as { unit_name: string; error: string }[],
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const match = matchResults[i];

      if (match.status === "unmatched" || !match.matched_id) {
        importResults.failed++;
        importResults.errors.push({
          unit_name: row.unit_name,
          error: "ไม่พบหน่วยงานที่ตรงกัน",
        });
        continue;
      }

      // Delete existing records for this unit and fiscal year
      const deleteQuery = supabase
        .from("budget_records")
        .delete()
        .eq("fiscal_year", fiscal_year);

      if (match.matched_type === "hospital") {
        await deleteQuery.eq("hospital_id", match.matched_id);
      } else {
        await deleteQuery.eq("health_office_id", match.matched_id);
      }

      // Prepare insert data - budgets keys are now order numbers (1-17)
      const insertData = [];
      for (const [orderStr, amount] of Object.entries(row.budgets)) {
        const orderNum = parseInt(orderStr, 10);
        const categoryId = categoryByOrder.get(orderNum);
        if (!categoryId) {
          console.warn(`Unknown category order: ${orderStr}`);
          continue;
        }

        insertData.push({
          hospital_id: match.matched_type === "hospital" ? match.matched_id : null,
          health_office_id: match.matched_type === "health_office" ? match.matched_id : null,
          fiscal_year: fiscal_year,
          category_id: categoryId,
          budget_amount: amount || 0,
          created_by: null, // Don't set created_by to avoid foreign key issues
        });
      }

      if (insertData.length > 0) {
        const { error: insertError } = await supabase.from("budget_records").insert(insertData);

        if (insertError) {
          console.error(`Error inserting for ${row.unit_name}:`, insertError);
          importResults.failed++;
          importResults.errors.push({
            unit_name: row.unit_name,
            error: insertError.message,
          });
        } else {
          importResults.success++;
        }
      }
    }

    console.log(`Import complete: ${importResults.success} success, ${importResults.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        mode: "import",
        imported: importResults.success,
        failed: importResults.failed,
        errors: importResults.errors,
        matches: matchResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in import-budget:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
