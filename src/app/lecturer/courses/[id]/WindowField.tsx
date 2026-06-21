"use client";

// The attendance-window picker on the "Take attendance" card: a number input
// paired with a seconds/minutes unit selector. Switching the unit resets the
// number to that unit's default and swaps the min/max bounds.
//
//   seconds — short "snapshot" windows: 30–120, default 60
//   minutes — natural-arrival windows:   1–180, default 15 (the default unit)
//
// The values are submitted as `windowValue` + `windowUnit`; the server action
// in page.tsx converts them to windowSeconds and re-validates the bounds.

import { useState } from "react";

const BOUNDS = {
  seconds: { min: 30, max: 120, default: 60 },
  minutes: { min: 1, max: 180, default: 15 },
} as const;

type Unit = keyof typeof BOUNDS;

export function WindowField() {
  const [unit, setUnit] = useState<Unit>("minutes");
  const [value, setValue] = useState<number | "">(BOUNDS.minutes.default);
  const bounds = BOUNDS[unit];

  return (
    <>
      <div>
        <label htmlFor="windowValue" className="label">Window</label>
        <input
          id="windowValue"
          name="windowValue"
          type="number"
          min={bounds.min}
          max={bounds.max}
          value={value}
          onChange={(e) => setValue(e.target.value === "" ? "" : Number(e.target.value))}
          className="input w-20"
        />
      </div>
      <div>
        <label htmlFor="windowUnit" className="label">Unit</label>
        <select
          id="windowUnit"
          name="windowUnit"
          value={unit}
          onChange={(e) => {
            const next = e.target.value as Unit;
            setUnit(next);
            setValue(BOUNDS[next].default);
          }}
          className="input w-28"
        >
          <option value="minutes">minutes</option>
          <option value="seconds">seconds</option>
        </select>
      </div>
    </>
  );
}
