import { getAxisTheme } from "@/shared/theme/axis-theme";

/** Identificador visual único dos eixos estruturais da plataforma. */
export function AxisBadge({
  axisName,
  prefix = true,
  className = "",
}: {
  axisName: string;
  prefix?: boolean;
  className?: string;
}) {
  const theme = getAxisTheme(axisName);
  const label = prefix ? `Eixo ${axisName}` : axisName;

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-md px-2.5 py-1 text-xs font-medium leading-none text-white ${className}`.trim()}
      style={{
        backgroundColor: theme.strong,
      }}
    >
      {label}
    </span>
  );
}
