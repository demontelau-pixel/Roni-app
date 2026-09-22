"use client";

import { useEffect, useState } from "react";

/**
 * Ported from the greeting logic in `homeScreen()`
 * (`new Date().getHours()`). This has to run on the client: the
 * visitor's local time is what decides "morning" vs "evening", and a
 * server-rendered guess would often be wrong (and could mismatch the
 * client on hydration). It starts with a neutral default and swaps in
 * the real greeting right after mount.
 */
export function Greeting({ firstName }: { firstName: string }) {
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  return (
    <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
      {greeting}, {firstName}.
    </h1>
  );
}
