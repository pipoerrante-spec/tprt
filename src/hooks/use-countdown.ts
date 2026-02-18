"use client";

import * as React from "react";

export function useCountdown(targetIso: string | null | undefined) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const target = targetIso ? new Date(targetIso).getTime() : null;
  const remainingMs = target ? Math.max(0, target - now) : 0;
  const expired = !!target && remainingMs <= 0;

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { remainingMs, mmss, expired };
}

