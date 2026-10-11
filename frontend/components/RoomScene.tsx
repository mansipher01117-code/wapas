/** Flat illustrations of a rented room wall, used on the landing page evidence board. */
export function RoomScene({ variant, later = false }: { variant: "crack" | "stain"; later?: boolean }) {
  const wall = later ? "#e4dcc8" : "#ece5d3";
  return (
    <svg viewBox="0 0 160 120" className="photo__img" role="img" aria-label={variant === "crack" ? "Wall with a crack under the window" : later ? "Wall with a dark stain beside the switchboard" : "Clean wall beside the switchboard"}>
      <rect width="160" height="120" fill={wall} />
      <rect y="96" width="160" height="24" fill="#b98c5d" stroke="#000" strokeWidth="2" />
      <path d="M0 104 H160 M0 112 H160" stroke="#8d6640" strokeWidth="1" />
      {variant === "crack" ? (
        <>
          <rect x="92" y="14" width="50" height="40" fill="#bfe0ea" stroke="#000" strokeWidth="2.5" />
          <path d="M117 14 V54 M92 34 H142" stroke="#000" strokeWidth="2" />
          <path d="M94 56 L88 66 L92 72 L84 82 L87 88 L80 96" fill="none" stroke="#2b2219" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M88 66 L82 69 M84 82 L78 82" fill="none" stroke="#2b2219" strokeWidth="1.4" />
          <rect x="18" y="58" width="40" height="38" fill="#7b5a3b" stroke="#000" strokeWidth="2.5" />
          <path d="M38 58 V96" stroke="#000" strokeWidth="2" />
          <circle cx="34" cy="78" r="2" fill="#000" />
          <circle cx="42" cy="78" r="2" fill="#000" />
        </>
      ) : (
        <>
          <rect x="30" y="40" width="34" height="22" rx="2" fill="#fbfbf6" stroke="#000" strokeWidth="2.5" />
          <rect x="36" y="46" width="6" height="10" fill="#000" />
          <rect x="46" y="46" width="6" height="10" fill="#000" />
          <circle cx="58" cy="51" r="2.5" fill="#000" />
          <path d="M120 10 V96" stroke="#000" strokeWidth="2" />
          <rect x="112" y="60" width="16" height="6" fill="#000" />
          {later ? (
            <path
              d="M70 44 C 80 34, 98 38, 100 52 C 103 64, 92 76, 80 74 C 66 72, 60 56, 70 44 Z"
              fill="#5a4a33"
              opacity="0.78"
            />
          ) : null}
        </>
      )}
    </svg>
  );
}
