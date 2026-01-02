import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ReportType = 'overview' | 'quantitative' | 'impact';
export type DrillPermission = 'all' | 'own_region' | 'own_province' | 'none';

export interface ReportAccessPolicy {
  id: string;
  role: string;
  report_type: string;
  view_region: boolean;
  drill_to_province: DrillPermission;
  drill_to_hospital: DrillPermission;
}

interface Province {
  id: string;
  health_region_id: string;
}

interface HealthOffice {
  id: string;
  province_id: string | null;
  health_region_id: string;
}

interface UseReportAccessPolicyResult {
  policy: ReportAccessPolicy | null;
  loading: boolean;
  canDrillToProvince: (regionId: string) => boolean;
  canDrillToHospital: (provinceId: string) => boolean;
  userProvinceId: string | null;
  userRegionId: string | null;
}

export function useReportAccessPolicy(
  reportType: ReportType,
  provinces: Province[],
  healthOffices: HealthOffice[]
): UseReportAccessPolicyResult {
  const { profile } = useAuth();
  const [policies, setPolicies] = useState<ReportAccessPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const { data, error } = await supabase
          .from('report_access_policies')
          .select('*');
        
        if (error) throw error;
        // Cast to proper types since DB returns string
        setPolicies((data || []).map(p => ({
          ...p,
          drill_to_province: p.drill_to_province as DrillPermission,
          drill_to_hospital: p.drill_to_hospital as DrillPermission,
        })));
      } catch (error) {
        console.error('Error fetching report access policies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
  }, []);

  // Get user's province_id
  const userProvinceId = useMemo(() => {
    if (!profile) return null;
    
    if (profile.role === 'hospital_it') {
      return profile.province_id || null;
    }
    
    if (profile.role === 'health_office' && profile.health_office_id) {
      const ho = healthOffices.find(h => h.id === profile.health_office_id);
      return ho?.province_id || null;
    }
    
    if (profile.role === 'provincial') {
      return profile.province_id || null;
    }
    
    return null;
  }, [profile, healthOffices]);

  // Get user's region_id
  const userRegionId = useMemo(() => {
    if (!profile) return null;
    
    if (profile.health_region_id) {
      return profile.health_region_id;
    }
    
    // Derive from province
    if (userProvinceId) {
      const province = provinces.find(p => p.id === userProvinceId);
      return province?.health_region_id || null;
    }
    
    return null;
  }, [profile, userProvinceId, provinces]);

  // Get policy for current user's role
  const policy = useMemo(() => {
    if (!profile || policies.length === 0) return null;
    return policies.find(p => p.role === profile.role && p.report_type === reportType) || null;
  }, [profile, policies, reportType]);

  // Check if user can drill to province level for a given region
  const canDrillToProvince = (regionId: string): boolean => {
    if (!policy) return true; // Default allow if no policy
    
    switch (policy.drill_to_province) {
      case 'all':
        return true;
      case 'own_region':
        return userRegionId === regionId;
      case 'none':
        return false;
      default:
        return true;
    }
  };

  // Check if user can drill to hospital level for a given province
  const canDrillToHospital = (provinceId: string): boolean => {
    if (!policy) return true; // Default allow if no policy
    
    switch (policy.drill_to_hospital) {
      case 'all':
        return true;
      case 'own_province':
        return userProvinceId === provinceId;
      case 'own_region': {
        // Check if province is in user's region
        const province = provinces.find(p => p.id === provinceId);
        return province?.health_region_id === userRegionId;
      }
      case 'none':
        return false;
      default:
        return true;
    }
  };

  return {
    policy,
    loading,
    canDrillToProvince,
    canDrillToHospital,
    userProvinceId,
    userRegionId,
  };
}
