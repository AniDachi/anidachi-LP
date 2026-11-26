import { useId } from "react";
import { ANIDACHI_LOGO_SRC } from "@/lib/brand";

export function InviteTicketStamp() {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" width="100" height="100" aria-hidden="true" focusable="false">
      <defs>
        <filter id={id} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          {/* Use the original mark's tones as heights in one gold surface. */}
          <feColorMatrix values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   .25 .42 .12 .21 0" result="height" />
          <feGaussianBlur in="height" stdDeviation=".64" result="bevel" />
          <feDiffuseLighting in="bevel" surfaceScale="4" lightingColor="#fff5d7" result="relief">
            <feDistantLight azimuth="225" elevation="48" />
          </feDiffuseLighting>
          <feColorMatrix in="height" values="0 0 0 .24 .69   0 0 0 .27 .51   0 0 0 .30 .26   0 0 0 0 1" result="gold" />
          <feBlend in="gold" in2="relief" mode="multiply" result="metal" />
          <feSpecularLighting in="bevel" surfaceScale="4" specularConstant=".64" specularExponent="18" lightingColor="#fff3d4" result="highlight">
            <feDistantLight azimuth="225" elevation="48" />
          </feSpecularLighting>
          <feComposite in="metal" in2="highlight" operator="arithmetic" k2="1" k3="1" result="stamp" />
          <feComposite in="stamp" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
      <image x="2" y="2" width="96" height="96" href={ANIDACHI_LOGO_SRC} filter={`url(#${id})`} />
    </svg>
  );
}
