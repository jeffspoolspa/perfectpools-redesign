import { useRef, useEffect, useState, useCallback } from 'preact/hooks';

/**
 * Custom horizontal slider — full pointer/touch control, no native range
 * input. Built because native <input type="range"> kept getting hit-test
 * issues inside the GSAP-pinned pillar card.
 *
 * Props mirror a typical slider API: min/max/step/value/onChange.
 * Visual: a track with a fill bar from start to current value, plus a
 * round thumb at the current value position.
 */

type SliderProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;
};

export default function Slider({ min, max, step, value, onChange }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const range = max - min;
  const normalized = Math.max(0, Math.min(1, (value - min) / range));
  const fillPct = normalized * 100;

  const valueFromClientX = useCallback((clientX: number): number | null => {
    if (!trackRef.current) return null;
    const rect = trackRef.current.getBoundingClientRect();
    const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + norm * range;
    const snapped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, snapped));
  }, [min, max, step, range]);

  const handleStart = (clientX: number) => {
    const v = valueFromClientX(clientX);
    if (v !== null) onChange(v);
    setIsDragging(true);
  };
  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    const v = valueFromClientX(clientX);
    if (v !== null) onChange(v);
  };
  const handleEnd = () => setIsDragging(false);

  // Latest-handler refs so the global listeners always read fresh closures
  // without re-subscribing on every value change.
  const moveRef = useRef(handleMove);
  const endRef = useRef(handleEnd);
  moveRef.current = handleMove;
  endRef.current = handleEnd;

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => moveRef.current(e.clientX);
    const onMouseUp = () => endRef.current();
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) moveRef.current(t.clientX);
    };
    const onTouchEnd = () => endRef.current();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging]);

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (t) handleStart(t.clientX);
  };

  return (
    <div
      class={`pp-slider ${isDragging ? 'is-dragging' : ''}`}
      ref={trackRef}
      onMouseDown={onMouseDown as any}
      onTouchStart={onTouchStart as any}
    >
      <div class="pp-slider__track" />
      <div class="pp-slider__fill" style={{ width: `${fillPct}%` }} />
      <div class="pp-slider__thumb" style={{ left: `${fillPct}%` }} />
    </div>
  );
}
