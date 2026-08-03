import isotipo from "@/assets/isotipo-pruebalista.png";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const ICON_SIZE: Record<Size, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8 sm:h-9 sm:w-9",
  lg: "h-12 w-12",
};

const TEXT_SIZE: Record<Size, string> = {
  sm: "text-xs",
  md: "text-sm sm:text-base",
  lg: "text-xl",
};

/** Isotipo de marca (check con degradado púrpura → turquesa). */
export const BrandIcon = ({ size = "md", className }: { size?: Size; className?: string }) => (
  <img
    src={isotipo}
    alt="PruebaLista"
    width={1024}
    height={1024}
    className={cn("object-contain", ICON_SIZE[size], className)}
  />
);

/** Logotipo completo: isotipo + nombre. */
export const BrandLogo = ({
  size = "md",
  className,
  textClassName,
  showText = true,
}: {
  size?: Size;
  className?: string;
  textClassName?: string;
  showText?: boolean;
}) => (
  <span className={cn("flex items-center gap-2", className)}>
    <BrandIcon size={size} />
    {showText && (
      <span className={cn("font-bold tracking-tight text-brand-purple", TEXT_SIZE[size], textClassName)}>
        PruebaLista<span className="text-primary">.cl</span>
      </span>
    )}
  </span>
);
