import { useMemo } from "react";

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
  onSkip,
  movieTitle,
  price,
}) {
  const tier = useMemo(() => tierFor(count), [count]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
      <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden">

        {/* Top drag indicator (BMS style) */}
        <div className="flex justify-center pt-3">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Movie name */}
        <div className="text-center pt-3 pb-2 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500">
            {movieTitle}
          </h2>
        </div>

        {/* Title */}
        <div className="pt-5">
          <h1 className="text-center text-xl font-semibold text-gray-900">
            How many seats?
          </h1>
        </div>

        {/* Vehicle illustration (clean BMS-like style) */}
        <div className="flex justify-center mt-6">
          <VehicleIcon kind={tier.label} />
        </div>

        {/* Subtitle */}
        <p className="text-center text-sm text-gray-500 mt-2">
          {tier.ride}
        </p>

        {/* Seat numbers */}
        <div className="flex flex-wrap justify-center gap-3 mt-6 px-6">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => onChangeCount(n)}
              className={`
                w-10 h-10 rounded-full border transition font-medium
                ${
                  count === n
                    ? "bg-red-500 text-white border-red-500 scale-110"
                    : "bg-white text-gray-700 border-gray-300 hover:border-red-400"
                }
              `}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Price */}
        {typeof price === "number" && (
          <div className="flex justify-center mt-6 pt-5 pb-1 px-6 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xs tracking-widest text-gray-400 font-medium">
                PRICE PER SEAT
              </p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                ₹{price}
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="px-5 mt-6">
          <button
            onClick={onConfirm}
            className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold active:scale-[0.99]"
          >
            Select {count} Seat{count > 1 ? "s" : ""}
          </button>
        </div>

        {/* Skip */}
        <button
          onClick={onSkip || onConfirm}
          className="w-full py-4 text-sm text-gray-500"
        >
          Skip
        </button>

      </div>
    </div>
  );
}

/* ---------------- Vehicle Icon (BMS-style clean version) ---------------- */

function VehicleIcon({ kind }) {
  const color = "#ef4444";

  if (kind === "bike") {
    return (
      <svg width="90" height="60" viewBox="0 0 90 60" fill="none">
        <circle cx="20" cy="45" r="10" stroke={color} strokeWidth="2" />
        <circle cx="70" cy="45" r="10" stroke={color} strokeWidth="2" />
        <path
          d="M20 45 L40 25 L55 25 L70 45 M40 25 L50 45"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === "auto") {
    return (
      <svg width="100" height="60" viewBox="0 0 100 60" fill="none">
        <circle cx="25" cy="45" r="8" stroke={color} strokeWidth="2" />
        <circle cx="75" cy="45" r="8" stroke={color} strokeWidth="2" />
        <path
          d="M20 40 Q20 25 35 25 H65 Q80 25 80 40"
          stroke={color}
          strokeWidth="2"
          fill="none"
        />
      </svg>
    );
  }

  if (kind === "car") {
    return (
      <svg width="110" height="60" viewBox="0 0 110 60" fill="none">
        <circle cx="30" cy="45" r="8" stroke={color} strokeWidth="2" />
        <circle cx="80" cy="45" r="8" stroke={color} strokeWidth="2" />
        <path
          d="M25 40 L35 25 H75 L85 40"
          stroke={color}
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg width="120" height="60" viewBox="0 0 120 60" fill="none">
      <rect
        x="15"
        y="25"
        width="90"
        height="20"
        rx="5"
        stroke={color}
        strokeWidth="2"
      />
      <circle cx="35" cy="48" r="6" stroke={color} strokeWidth="2" />
      <circle cx="85" cy="48" r="6" stroke={color} strokeWidth="2" />
    </svg>
  );
}