import { Icon } from "@/components/ui/Icon";

interface CmsAttributionProps {
  compact?: boolean;
}

/** Ported from the M2.5 requirement to clearly label real vs prototype data. */
export function CmsAttribution({ compact = false }: CmsAttributionProps) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-2.5 py-1 text-xs font-bold text-primary">
        <Icon name="lock" size={13} />
        Real data — CMS / HealthCare.gov
      </span>
    );
  }
  return (
    <div className="rounded-2xl bg-soft px-3.5 py-3 text-sm text-primary">
      <div className="flex items-center gap-1.5 font-bold">
        <Icon name="lock" size={15} />
        Marketplace data provided by CMS / HealthCare.gov
      </div>
      <p className="mt-1 text-ink">
        These are real plans and real prices from the federal Health Insurance Marketplace. RONI
        doesn&rsquo;t sell or bind these plans — to enroll, you&rsquo;ll go through HealthCare.gov or a
        licensed professional.
      </p>
    </div>
  );
}
