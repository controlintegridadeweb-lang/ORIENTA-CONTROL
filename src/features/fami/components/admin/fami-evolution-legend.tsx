type Props = {
  axisNames: string[];
  axisColors: readonly string[];
  className?: string;
};

export function FamiEvolutionLegend({ axisNames, axisColors, className = "" }: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-3 text-slate-600 ${className}`.trim()}>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-0.5 w-4 bg-slate-900" aria-hidden />
        Global
      </span>
      {axisNames.map((name, index) => (
        <span key={name} className="inline-flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4 border-t-2 border-dashed"
            style={{ borderColor: axisColors[index % axisColors.length] }}
            aria-hidden
          />
          {name}
        </span>
      ))}
    </div>
  );
}
