CREATE OR REPLACE FUNCTION public.get_public_report_summary(p_fiscal_year integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'health_regions', (
      SELECT COALESCE(json_agg(row_to_json(r.*) ORDER BY r.region_number), '[]'::json)
      FROM health_regions r
    ),
    'provinces', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', p.id,
        'name', p.name,
        'health_region_id', p.health_region_id
      ) ORDER BY p.name), '[]'::json)
      FROM provinces p
    ),
    'region_stats', (
      SELECT COALESCE(json_agg(region_data ORDER BY region_data.region_number), '[]'::json)
      FROM (
        SELECT 
          hr.id,
          hr.name,
          hr.region_number,
          (
            SELECT COUNT(*)::integer 
            FROM hospitals h
            JOIN provinces prov ON prov.id = h.province_id
            WHERE prov.health_region_id = hr.id
          ) + (
            SELECT COUNT(*)::integer 
            FROM health_offices ho
            WHERE ho.health_region_id = hr.id
          ) as total_units,
          (
            SELECT COUNT(DISTINCT COALESCE(a.hospital_id, a.health_office_id))::integer
            FROM assessments a
            LEFT JOIN hospitals h ON h.id = a.hospital_id
            LEFT JOIN provinces prov ON prov.id = h.province_id
            LEFT JOIN health_offices ho ON ho.id = a.health_office_id
            WHERE (prov.health_region_id = hr.id OR ho.health_region_id = hr.id)
              AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
              AND a.status != 'draft'
          ) as with_assessment,
          (
            SELECT COUNT(DISTINCT COALESCE(a.hospital_id, a.health_office_id))::integer
            FROM assessments a
            LEFT JOIN hospitals h ON h.id = a.hospital_id
            LEFT JOIN provinces prov ON prov.id = h.province_id
            LEFT JOIN health_offices ho ON ho.id = a.health_office_id
            WHERE (prov.health_region_id = hr.id OR ho.health_region_id = hr.id)
              AND a.status IN ('approved_regional', 'completed')
              AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
          ) as completed,
          (
            SELECT COUNT(DISTINCT COALESCE(a.hospital_id, a.health_office_id))::integer
            FROM assessments a
            LEFT JOIN hospitals h ON h.id = a.hospital_id
            LEFT JOIN provinces prov ON prov.id = h.province_id
            LEFT JOIN health_offices ho ON ho.id = a.health_office_id
            WHERE (prov.health_region_id = hr.id OR ho.health_region_id = hr.id)
              AND a.status IN ('submitted', 'approved_provincial')
              AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
          ) as pending,
          (
            SELECT COALESCE(AVG(latest.total_score), 0)
            FROM (
              SELECT DISTINCT ON (COALESCE(a.hospital_id, a.health_office_id)) 
                a.total_score
              FROM assessments a
              LEFT JOIN hospitals h ON h.id = a.hospital_id
              LEFT JOIN provinces prov ON prov.id = h.province_id
              LEFT JOIN health_offices ho ON ho.id = a.health_office_id
              WHERE (prov.health_region_id = hr.id OR ho.health_region_id = hr.id)
                AND a.total_score IS NOT NULL
                AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
              ORDER BY COALESCE(a.hospital_id, a.health_office_id), a.fiscal_year DESC, a.assessment_period DESC
            ) latest
          ) as avg_score,
          -- Fixed: Use impact_score instead of qualitative_score for คะแนนเชิงผลกระทบ
          (
            SELECT COALESCE(AVG(latest.impact_score), 0)
            FROM (
              SELECT DISTINCT ON (COALESCE(a.hospital_id, a.health_office_id)) 
                a.impact_score
              FROM assessments a
              LEFT JOIN hospitals h ON h.id = a.hospital_id
              LEFT JOIN provinces prov ON prov.id = h.province_id
              LEFT JOIN health_offices ho ON ho.id = a.health_office_id
              WHERE (prov.health_region_id = hr.id OR ho.health_region_id = hr.id)
                AND a.impact_score IS NOT NULL
                AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
              ORDER BY COALESCE(a.hospital_id, a.health_office_id), a.fiscal_year DESC, a.assessment_period DESC
            ) latest
          ) as avg_qualitative_score,
          (
            SELECT COALESCE(AVG(latest.quantitative_score), 0)
            FROM (
              SELECT DISTINCT ON (COALESCE(a.hospital_id, a.health_office_id)) 
                a.quantitative_score
              FROM assessments a
              LEFT JOIN hospitals h ON h.id = a.hospital_id
              LEFT JOIN provinces prov ON prov.id = h.province_id
              LEFT JOIN health_offices ho ON ho.id = a.health_office_id
              WHERE (prov.health_region_id = hr.id OR ho.health_region_id = hr.id)
                AND a.quantitative_score IS NOT NULL
                AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
              ORDER BY COALESCE(a.hospital_id, a.health_office_id), a.fiscal_year DESC, a.assessment_period DESC
            ) latest
          ) as avg_quantitative_score
        FROM health_regions hr
      ) region_data
    ),
    'province_stats', (
      SELECT COALESCE(json_agg(province_data ORDER BY province_data.name), '[]'::json)
      FROM (
        SELECT 
          p.id,
          p.name,
          p.health_region_id,
          (
            SELECT COUNT(*)::integer 
            FROM hospitals h
            WHERE h.province_id = p.id
          ) + (
            SELECT COUNT(*)::integer 
            FROM health_offices ho
            WHERE ho.province_id = p.id
          ) as total_units,
          (
            SELECT COUNT(DISTINCT COALESCE(a.hospital_id, a.health_office_id))::integer
            FROM assessments a
            LEFT JOIN hospitals h ON h.id = a.hospital_id
            LEFT JOIN health_offices ho ON ho.id = a.health_office_id
            WHERE (h.province_id = p.id OR ho.province_id = p.id)
              AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
              AND a.status != 'draft'
          ) as with_assessment,
          (
            SELECT COUNT(DISTINCT COALESCE(a.hospital_id, a.health_office_id))::integer
            FROM assessments a
            LEFT JOIN hospitals h ON h.id = a.hospital_id
            LEFT JOIN health_offices ho ON ho.id = a.health_office_id
            WHERE (h.province_id = p.id OR ho.province_id = p.id)
              AND a.status IN ('approved_regional', 'completed')
              AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
          ) as completed,
          (
            SELECT COUNT(DISTINCT COALESCE(a.hospital_id, a.health_office_id))::integer
            FROM assessments a
            LEFT JOIN hospitals h ON h.id = a.hospital_id
            LEFT JOIN health_offices ho ON ho.id = a.health_office_id
            WHERE (h.province_id = p.id OR ho.province_id = p.id)
              AND a.status IN ('submitted', 'approved_provincial')
              AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
          ) as pending,
          (
            SELECT COALESCE(AVG(latest.total_score), 0)
            FROM (
              SELECT DISTINCT ON (COALESCE(a.hospital_id, a.health_office_id)) 
                a.total_score
              FROM assessments a
              LEFT JOIN hospitals h ON h.id = a.hospital_id
              LEFT JOIN health_offices ho ON ho.id = a.health_office_id
              WHERE (h.province_id = p.id OR ho.province_id = p.id)
                AND a.total_score IS NOT NULL
                AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
              ORDER BY COALESCE(a.hospital_id, a.health_office_id), a.fiscal_year DESC, a.assessment_period DESC
            ) latest
          ) as avg_score,
          -- Fixed: Use impact_score instead of qualitative_score for คะแนนเชิงผลกระทบ
          (
            SELECT COALESCE(AVG(latest.impact_score), 0)
            FROM (
              SELECT DISTINCT ON (COALESCE(a.hospital_id, a.health_office_id)) 
                a.impact_score
              FROM assessments a
              LEFT JOIN hospitals h ON h.id = a.hospital_id
              LEFT JOIN health_offices ho ON ho.id = a.health_office_id
              WHERE (h.province_id = p.id OR ho.province_id = p.id)
                AND a.impact_score IS NOT NULL
                AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
              ORDER BY COALESCE(a.hospital_id, a.health_office_id), a.fiscal_year DESC, a.assessment_period DESC
            ) latest
          ) as avg_qualitative_score,
          (
            SELECT COALESCE(AVG(latest.quantitative_score), 0)
            FROM (
              SELECT DISTINCT ON (COALESCE(a.hospital_id, a.health_office_id)) 
                a.quantitative_score
              FROM assessments a
              LEFT JOIN hospitals h ON h.id = a.hospital_id
              LEFT JOIN health_offices ho ON ho.id = a.health_office_id
              WHERE (h.province_id = p.id OR ho.province_id = p.id)
                AND a.quantitative_score IS NOT NULL
                AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
              ORDER BY COALESCE(a.hospital_id, a.health_office_id), a.fiscal_year DESC, a.assessment_period DESC
            ) latest
          ) as avg_quantitative_score
        FROM provinces p
      ) province_data
    ),
    'fiscal_years', (
      SELECT COALESCE(json_agg(DISTINCT a.fiscal_year ORDER BY a.fiscal_year DESC), '[]'::json)
      FROM assessments a
      WHERE a.fiscal_year IS NOT NULL
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;