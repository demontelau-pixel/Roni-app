"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { RoniAvatar } from "@/components/roni/RoniAvatar";
import { cx } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/market", label: "Marketplace", icon: "market" },
  { href: "/wallet", label: "Wallet", icon: "wallet" },
  { href: "/profile", label: "Profile", icon: "user" },
];

/**
 * Ported from `renderNav()`. On narrow screens this renders as the
 * bottom tab bar; from 900px wide (the same breakpoint the original
 * prototype used) it becomes a left sidebar — see `AppShell`, which
 * reverses the flex row so this ends up on the left while `<main>`
 * stays first in the DOM.
 */
export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-end gap-1.5 border-t border-line bg-surface px-1.5 pb-2 pt-1.5 min-[900px]:w-[236px] min-[900px]:flex-none min-[900px]:flex-col min-[900px]:items-stretch min-[900px]:border-t-0 min-[900px]:border-r min-[900px]:px-3.5 min-[900px]:py-6.5">
      <div className="hidden min-[900px]:flex items-center gap-2.5 px-3 pb-5.5 text-[22px] font-extrabold tracking-wide">
        <RoniAvatar size={30} />
        RONI
      </div>

      <Link
        href="/ask"
        aria-current={pathname === "/ask" ? "page" : undefined}
        className={cx(
          "flex flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11.5px] font-semibold",
          "min-[900px]:order-first min-[900px]:mb-2.5 min-[900px]:flex-row min-[900px]:justify-start min-[900px]:gap-3 min-[900px]:px-3.5 min-[900px]:py-3 min-[900px]:text-[15.5px] min-[900px]:bg-sun min-[900px]:text-deep",
          "-mt-7 min-[900px]:mt-0",
        )}
      >
        <span className="flex rounded-full shadow-[0_0_0_5px_var(--bg),0_6px_14px_rgba(16,34,58,0.3)] min-[900px]:hidden">
          <RoniAvatar size={56} />
        </span>
        <RoniAvatar size={28} className="hidden min-[900px]:block" />
        Ask Roni
      </Link>

      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11.5px] font-semibold text-muted",
              "min-[900px]:flex-row min-[900px]:justify-start min-[900px]:gap-3 min-[900px]:px-3.5 min-[900px]:py-3 min-[900px]:text-[15.5px]",
              active && "text-primary min-[900px]:bg-soft",
            )}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
