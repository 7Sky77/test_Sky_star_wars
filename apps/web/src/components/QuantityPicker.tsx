import { useId } from "react";

type QuantityPickerProps = {
  value: number;
  max: number;
  min?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  showSlider?: boolean;
  compact?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function QuantityPicker({
  value,
  max,
  min = 0,
  onChange,
  disabled = false,
  showSlider = true,
  compact = false,
}: QuantityPickerProps) {
  const id = useId();
  const safeMax = Math.max(min, max);
  const v = clamp(value, min, safeMax);

  function set(next: number) {
    onChange(clamp(next, min, safeMax));
  }

  return (
    <div className={`qty-picker${compact ? " qty-picker-compact" : ""}`}>
      {showSlider && safeMax > min && (
        <input
          id={id}
          type="range"
          className="qty-slider"
          min={min}
          max={safeMax}
          value={v}
          disabled={disabled || safeMax <= min}
          onChange={(e) => set(Number(e.target.value))}
        />
      )}
      <div className="qty-controls">
        <button
          type="button"
          className="btn btn-qty"
          disabled={disabled || v <= min}
          onClick={() => set(v - 1)}
          aria-label="Уменьшить"
        >
          −
        </button>
        <input
          type="number"
          className="qty-input"
          min={min}
          max={safeMax}
          value={v}
          disabled={disabled}
          onChange={(e) => set(Number(e.target.value) || min)}
        />
        <button
          type="button"
          className="btn btn-qty"
          disabled={disabled || v >= safeMax}
          onClick={() => set(v + 1)}
          aria-label="Увеличить"
        >
          +
        </button>
        <button
          type="button"
          className="btn btn-qty btn-max"
          disabled={disabled || safeMax <= min}
          onClick={() => set(safeMax)}
        >
          max
        </button>
      </div>
      {!compact && safeMax > 0 && (
        <div className="qty-range-label stub">
          {min} … {safeMax}
        </div>
      )}
    </div>
  );
}
