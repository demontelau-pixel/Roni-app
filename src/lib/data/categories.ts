import type { PolicyCategory } from "@/lib/types";
import type { IconName } from "@/components/ui/Icon";

export interface CategoryMeta {
  label: string;
  icon: IconName;
  /** Categories not yet backed by a real quoting flow ("Coming soon" badge). */
  comingSoon?: boolean;
}

/** Ported from the prototype's `CATS` map. */
export const CATEGORY_META: Record<PolicyCategory, CategoryMeta> = {
  auto: { label: "Auto", icon: "car" },
  home: { label: "Home", icon: "home" },
  renters: { label: "Renters", icon: "building" },
  life: { label: "Life", icon: "shield" },
  health: { label: "Health", icon: "heart" },
  pet: { label: "Pet", icon: "paw" },
};
