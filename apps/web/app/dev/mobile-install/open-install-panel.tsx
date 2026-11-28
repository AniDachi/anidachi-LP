"use client";

import { useContext, useEffect } from "react";
import { MobileInstallContext } from "@/components/install-link";

export function OpenInstallPanel() {
  const panel = useContext(MobileInstallContext);
  useEffect(() => { panel?.open(); }, [panel]);
  return null;
}
