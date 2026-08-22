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
      className={`inline-flex min-h-6 items-center rounded-md border px-2.5 py-1 text-xs font-medium leading-none ${className}`.trim()}
      style={{
        backgroundColor: theme.softBackground,
        borderColor: theme.border,
        color: theme.text,
      }}
    >
      {label}
    </span>
  );
}
