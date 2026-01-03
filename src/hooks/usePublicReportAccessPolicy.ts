import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ReportType = 'overview' | 'quantitative' | 'impact';
export type DrillPermission = 'all' | 'own_region' | 'own_province' | 'none';

export interface ReportAccessPolicy {
  id: string;
  role: string;
  report_type: string;
  view_region: boolean;
  drill_to_province: DrillPermission;
  drill_to_hospital: DrillPermission;
  view_same_province_hospitals: boolean;
}

interface UsePublicReportAccessPolicyResult {
  policy: ReportAccessPolicy | null;
  loading: boolean;
  canDrillToProvince: (regionId: string) => boolean;
  canDrillToHospital: (provinceId: string) => boolean;
}

export function usePublicReportAccessPolicy(
  reportType: ReportType
): UsePublicReportAccessPolicyResult {
  const [policies, setPolicies] = useState<ReportAccessPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const { data, error } = await supabase
          .from('report_access_policies')
          .select('*')
          .eq('role', 'public');
        
        if (error) throw error;
        setPolicies((data || []).map(p => ({
          ...p,
          drill_to_province: p.drill_to_province as DrillPermission,
          drill_to_hospital: p.drill_to_hospital as DrillPermission,
          view_same_province_hospitals: p.view_same_province_hospitals ?? false,
        })));
      } catch (error) {
        console.error('Error fetching public report access policies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
  }, []);

  const policy = useMemo(() => {
    return policies.find(p => p.report_type === reportType) || null;
  }, [policies, reportType]);

  // Public users can drill to province level for all regions
  const canDrillToProvince = (regionId: string): boolean => {
    if (!policy) return true;
    return policy.drill_to_province === 'all';
  };

  // Public users cannot drill to hospital level (policy is 'none')
  const canDrillToHospital = (provinceId: string): boolean => {
    if (!policy) return false;
    return policy.drill_to_hospital !== 'none';
  };

  return {
    policy,
    loading,
    canDrillToProvince,
    canDrillToHospital,
  };
}
