import type { MarketplaceCategory, PolicyCategory } from "@/lib/types";
import type { IconName } from "@/components/ui/Icon";

export interface CategoryMeta {
  label: string;
  icon: IconName;
  /** Categories not yet backed by a real quoting flow ("Coming soon" badge). */
  comingSoon?: boolean;
}

/** Ported from the prototype's `CATS` map. Used by Home (which only ever
 *  deals in real, ownable categories) and by the Marketplace grid. */
export const CATEGORY_META: Record<PolicyCategory, CategoryMeta> = {
  auto: { label: "Auto", icon: "car" },
  home: { label: "Home", icon: "home" },
  renters: { label: "Renters", icon: "building" },
  life: { label: "Life", icon: "shield" },
  health: { label: "Health", icon: "heart" },
  pet: { label: "Pet", icon: "paw" },
};

/**
 * The full Marketplace grid (M2 §1): every `PolicyCategory` plus two
 * categories that have no policy/Wallet concept yet. Only Auto has a
 * working quote flow this milestone — everything else is `comingSoon`.
 */
export const MARKETPLACE_CATEGORY_META: Record<MarketplaceCategory, CategoryMeta> = {
  ...CATEGORY_META,
  home: { ...CATEGORY_META.home, comingSoon: true },
  renters: { ...CATEGORY_META.renters, comingSoon: true },
  life: { ...CATEGORY_META.life, comingSoon: true },
  pet: { ...CATEGORY_META.pet, comingSoon: true },
  motorcycle: { label: "Motorcycle", icon: "moto", comingSoon: true },
  travel: { label: "Travel", icon: "plane", comingSoon: true },
};

/** Display order for the Marketplace grid (M2 spec §1). */
export const MARKETPLACE_CATEGORY_ORDER: MarketplaceCategory[] = [
  "auto",
  "home",
  "renters",
  "life",
  "health",
  "motorcycle",
  "pet",
  "travel",
];

