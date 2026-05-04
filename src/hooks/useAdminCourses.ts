import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage } from "@/hooks/useUserUsage";
import type { GradeOption, SchoolLevel } from "@/lib/catalog";

/**
 * Loads grades from admin_courses table (source of truth).
 * For non-staff users with a plan, filters by plan_allowed_courses.
 */
export function useAdminCourses(): { grades: GradeOption[]; loading: boolean } {
  const { isStaff } = useAuth();
  const { effectivePlan } = useUserUsage();
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // 1. Load all courses from admin_courses
      const { data: courses } = await supabase
        .from("admin_courses")
        .select("id, grade_value, label, level, sort_order")
        .order("sort_order");

      if (cancelled || !courses) {
        if (!cancelled) setLoading(false);
        return;
      }

      let filtered = courses;

      // 2. For non-staff with a plan, filter by plan_allowed_courses
      if (!isStaff && effectivePlan) {
        const { data: allowed } = await supabase
          .from("plan_allowed_courses")
          .select("course_id")
          .eq("plan_id", effectivePlan);

        if (!cancelled && allowed && allowed.length > 0) {
          const allowedIds = new Set(allowed.map((a) => a.course_id));
          filtered = courses.filter((c) => allowedIds.has(c.id));
        }
      }

      if (!cancelled) {
        setGrades(
          filtered.map((c) => ({
            value: c.grade_value,
            label: c.label,
            level: c.level as SchoolLevel,
          }))
        );
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isStaff, effectivePlan]);

  return { grades, loading };
}
