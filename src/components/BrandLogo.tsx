import { useState } from "react";

import {
  brandLettermark,
  brandLogoUrl,
  connectorBrandLogoUrl,
  resolveBrandDomain,
  type BrandLogoTheme,
  type BrandLogoType,
} from "@/lib/brandfetch";

type Props = {
  /** Id catalogo (es. gmail, one:slack, mega) o dominio diretto */
  id?: string;
  domain?: string;
  label: string;
  size?: number;
  theme?: BrandLogoTheme;
  type?: BrandLogoType;
  className?: string;
};

/**
 * Logo brand via Brandfetch CDN (hotlink) con fallback lettermark.
 * Richiede VITE_BRANDFETCH_CLIENT_ID (o localStorage omnicore.brandfetch.clientId).
 */
export function BrandLogo({
  id,
  domain,
  label,
  size = 28,
  theme = "dark",
  type = "icon",
  className = "",
}: Props) {
  const resolvedDomain = domain || (id ? resolveBrandDomain({ id, label }) : null);
  const src =
    (id ? connectorBrandLogoUrl(id, { label, w: size * 2, h: size * 2, theme, type }) : null) ||
    (resolvedDomain
      ? brandLogoUrl({ domain: resolvedDomain, w: size * 2, h: size * 2, theme, type })
      : null);

  const [failed, setFailed] = useState(false);
  const showImg = Boolean(src) && !failed;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/80 ${className}`}
      style={{ width: size, height: size }}
      title={label}
    >
      {showImg ? (
        <img
          src={src!}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-contain p-0.5"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="select-none font-semibold text-primary"
          style={{ fontSize: Math.max(10, size * 0.36) }}
        >
          {brandLettermark(label)}
        </span>
      )}
    </span>
  );
}
