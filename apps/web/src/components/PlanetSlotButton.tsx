import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  planetTypeClass,
  planetVariantIndex,
  planetVisualStyle,
  planetSpriteUrl,
} from "../planetVisuals.js";
import type { GalaxySlot } from "../types.js";

type PlanetSlotVariant = "slot" | "orbit";

interface PlanetSlotButtonProps {
  variant: PlanetSlotVariant;
  arm: number;
  system: number;
  slot: GalaxySlot;
  selected?: boolean;
  typeName?: string;
  typeDescription?: string;
  orbitStyle?: { left: string; top: string };
  onSelect: () => void;
}

export function PlanetSlotButton({
  variant,
  arm,
  system,
  slot,
  selected = false,
  typeName,
  typeDescription,
  orbitStyle,
  onSelect,
}: PlanetSlotButtonProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);

  const visual = planetVisualStyle(
    slot.planetTypeId,
    slot.position,
    arm,
    system
  );
  const variantIdx = planetVariantIndex(slot.position, arm, system);
  const spriteUrl = planetSpriteUrl(slot.planetTypeId, variantIdx);

  const showPreview = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPreview({ x: r.left + r.width / 2, y: r.top });
  }, []);

  const hidePreview = useCallback(() => setPreview(null), []);

  const stateClass = `${slot.isYours ? "yours" : ""} ${
    slot.ownerUsername ? "occupied" : "empty"
  } ${selected ? "selected" : ""}`;

  const label =
    typeName != null
      ? `${slot.label} · ${typeName}`
      : slot.label;

  const buttonClass =
    variant === "orbit"
      ? `orbit-planet ${planetTypeClass(slot.planetTypeId)} ${stateClass}`
      : `slot planet ${planetTypeClass(slot.planetTypeId)} ${stateClass}`;

  return (
    <div
      ref={wrapRef}
      className={`planet-hover-wrap planet-hover-wrap--${variant}`}
      style={orbitStyle}
      onMouseEnter={showPreview}
      onMouseLeave={hidePreview}
      onFocus={showPreview}
      onBlur={hidePreview}
    >
      <button
        type="button"
        className={buttonClass}
        style={visual}
        onClick={onSelect}
        aria-label={label}
      >
        <span className={variant === "orbit" ? "orbit-num" : "slot-num"}>
          {slot.position}
        </span>
        {variant === "slot" && slot.ownerUsername && (
          <span className="who">{slot.ownerUsername}</span>
        )}
      </button>

      {preview &&
        createPortal(
          <div
            className="planet-hover-preview"
            style={{ left: preview.x, top: preview.y }}
            role="tooltip"
          >
            <img
              src={spriteUrl}
              alt=""
              className={`planet-hover-preview-img ${planetTypeClass(slot.planetTypeId)}`}
              style={{ filter: visual.filter }}
            />
            <div className="planet-hover-preview-body">
              <div className="planet-hover-preview-title">{slot.label}</div>
              {typeName && (
                <div className="planet-hover-preview-type">{typeName}</div>
              )}
              {typeDescription && (
                <div className="planet-hover-preview-desc">{typeDescription}</div>
              )}
              {slot.planetName && (
                <div className="planet-hover-preview-meta">{slot.planetName}</div>
              )}
              {slot.ownerUsername ? (
                <div className="planet-hover-preview-meta">
                  {slot.isYours ? "Ваша колония" : slot.ownerUsername}
                </div>
              ) : (
                <div className="planet-hover-preview-meta muted">Свободна</div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
