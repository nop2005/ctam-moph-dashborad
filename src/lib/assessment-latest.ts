// Shared helpers for selecting the "latest" assessment per unit (hospital/health office)

export const isApprovedAssessmentStatus = (status?: string | null) =>
  status === 'approved_regional' || status === 'completed';

type AssessmentLike = {
  id: string;
  hospital_id: string | null;
  health_office_id?: string | null;
  fiscal_year: number;
  assessment_period?: string | null;
  created_at?: string | null;
};

const parsePeriodNumber = (period?: string | null): number | null => {
  if (!period) return null;
  const match = period.match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

const compareRecency = (a: AssessmentLike, b: AssessmentLike): number => {
  // higher => a is newer
  if (a.fiscal_year !== b.fiscal_year) return a.fiscal_year - b.fiscal_year;

  const ap = parsePeriodNumber(a.assessment_period);
  const bp = parsePeriodNumber(b.assessment_period);
  if (ap != null && bp != null && ap !== bp) return ap - bp;

  // fallback to string compare when period isn't numeric
  if (a.assessment_period && b.assessment_period && a.assessment_period !== b.assessment_period) {
    return a.assessment_period.localeCompare(b.assessment_period);
  }

  const at = a.created_at ? Date.parse(a.created_at) : NaN;
  const bt = b.created_at ? Date.parse(b.created_at) : NaN;
  if (!Number.isNaN(at) && !Number.isNaN(bt) && at !== bt) return at - bt;

  return 0;
};

export const getLatestAssessmentsByUnit = <T extends AssessmentLike>(assessments: T[]) => {
  const latest = new Map<string, T>();

  for (const a of assessments) {
    const unitId = a.hospital_id || a.health_office_id;
    if (!unitId) continue;

    const existing = latest.get(unitId);
    if (!existing) {
      latest.set(unitId, a);
      continue;
    }

    if (compareRecency(a, existing) > 0) {
      latest.set(unitId, a);
    }
  }

  return latest;
};
