import { useMemo } from "react";

// Vehicle scales with how many people are travelling together — a small
// visual joke that also doubles as a size cue before the real seat map opens.
const TIERS = [
  { max: 1, label: "bike", ride: "Solo ride" },
  { max: 3, label: "auto", ride: "Auto share" },
  { max: 6, label: "car", ride: "Car pool" },
  { max: 10, label: "bus", ride: "Group outing" },
];

function tierFor(count) {
  return TIERS.find((t) => count <= t.max) || TIERS[TIERS.length - 1];
}

export default function SeatCountModal({
  open,
  max = 10,
  count,
  onChangeCount,
  onConfirm,
  movieTitle,
}) {
  const tier = useMemo(() => tierFor(count), [count]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-neutral-900 p-6 sm:rounded-2xl">
        <p className="text-center text-xs uppercase tracking-widest text-neutral-500">
          {movieTitle}
        </p>
        <h2 className="mt-1 text-center text-xl font-semibold text-neutral-100">
          How many seats?
        </h2>

        <div className="my-6 flex h-24 items-center justify-center">
          <VehicleIcon kind={tier.label} />
        </div>
        <p className="-mt-4 mb-6 text-center text-xs text-neutral-500">{tier.ride}</p>

        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChangeCount(n)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                n === count
                  ? "bg-rose-500 text-white"
                  : "text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onConfirm}
          className="mt-8 w-full rounded-lg bg-rose-500 py-3 text-sm font-semibold text-white hover:bg-rose-400"
        >
          Continue with {count} seat{count !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

function VehicleIcon({ kind }) {
  const common = { fill: "none", stroke: "#fb7185", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };

  if (kind === "bike") {
    return (
      <svg width="96" height="72" viewBox="0 0 96 72" {...common}>
        <circle cx="22" cy="52" r="14" />
        <circle cx="74" cy="52" r="14" />
        <path d="M22 52 L44 24 L60 24 M44 24 L58 52 M58 52 L74 52 M58 52 L48 40" />
        <path d="M60 24 L66 18 M40 18 H52" />
      </svg>
    );
  }
  if (kind === "auto") {
    return (
      <svg width="104" height="72" viewBox="0 0 104 72" {...common}>
        <path d="M14 52 A10 10 0 1 0 14 52.1" />
        <circle cx="20" cy="54" r="9" />
        <circle cx="80" cy="54" r="9" />
        <path d="M12 46 V26 Q12 18 22 18 H46 Q54 18 54 28 V46" />
        <path d="M54 30 H84 Q92 30 92 40 V46 H12" />
        <path d="M28 18 V10 M40 18 V10" />
      </svg>
    );
  }
  if (kind === "car") {
    return (
      <svg width="112" height="64" viewBox="0 0 112 64" {...common}>
        <path d="M10 44 V34 Q10 26 20 24 L30 12 Q34 8 42 8 H70 Q78 8 82 14 L90 24 Q102 26 102 36 V44" />
        <path d="M6 44 H106" />
        <circle cx="28" cy="46" r="8" />
        <circle cx="86" cy="46" r="8" />
        <path d="M34 24 H86" />
      </svg>
    );
  }
  return (
    <svg width="120" height="72" viewBox="0 0 120 72" {...common}>
      <rect x="8" y="12" width="104" height="38" rx="6" />
      <path d="M8 26 H112" />
      <path d="M24 26 V50 M44 26 V50 M64 26 V50 M84 26 V50 M100 26 V50" />
      <circle cx="28" cy="58" r="7" />
      <circle cx="92" cy="58" r="7" />
    </svg>
  );
}