import type { CSSProperties } from "react";

type Tone = "safe" | "liable" | "worse" | "fixed" | "violet";

export function Stamp({
  main,
  sub,
  tone = "violet",
  size = "md",
  rotate = -8,
  slam = false,
  delay = 0,
  seal = false,
  className = "",
}: {
  main: string;
  sub?: string;
  tone?: Tone | string;
  size?: "sm" | "md" | "lg";
  rotate?: number;
  slam?: boolean;
  delay?: number;
  seal?: boolean;
  className?: string;
}) {
  const style = { "--r": `${rotate}deg`, "--delay": `${delay}s` } as CSSProperties;
  const cls = [
    "stamp",
    `stamp--${tone}`,
    size !== "md" ? `stamp--${size}` : "",
    seal ? "stamp--seal" : "",
    slam ? "stamp--slam" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} style={style} role="img" aria-label={sub ? `${main}, ${sub}` : main}>
      <span className="stamp__main">{main}</span>
      {sub ? <span className="stamp__sub">{sub}</span> : null}
    </span>
  );
}

/** SVG filter that roughens stamp edges like rubber on paper. Rendered once in the root layout. */
export function InkFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="ink-rough">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="4" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" />
      </filter>
    </svg>
  );
}
