import { useEffect, useRef, useCallback } from 'preact/hooks';
import { assetPath } from '../utils/base-url';

interface LiquidHeroProps {
  title?: string[];
  eyebrow?: string;
  subtitle?: string;
  showText?: boolean;
}

declare global {
  interface Window {
    __liquidApp?: any;
  }
}

export default function LiquidHero({
  title = ["Pool care isn't", "guesswork.", "It's chemistry."],
  eyebrow = "Our Approach",
  subtitle = "Why clear water isn't luck — it's science, consistency, and accountability.",
  showText = true,
}: LiquidHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateTextImage = useCallback(() => {
    return new Promise<string | null>((resolve) => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      const img = new Image();
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = w * dpr;
        offscreen.height = h * dpr;
        const ctx = offscreen.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.scale(dpr, dpr);

        // === BACKGROUND: Draw pool water photo, cover-fit ===
        const imgRatio = img.width / img.height;
        const canvasRatio = w / h;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (imgRatio > canvasRatio) {
          sw = img.height * canvasRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / canvasRatio;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

        // Darken for depth + text readability
        ctx.fillStyle = 'rgba(0, 15, 40, 0.35)';
        ctx.fillRect(0, 0, w, h);

        // Boost saturation to counteract the shader's white lighting
        ctx.globalCompositeOperation = 'saturation';
        ctx.fillStyle = 'hsl(200, 100%, 50%)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';

        if (showText) {
          // === EYEBROW ===
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          const eyebrowSize = Math.max(11, w * 0.009);
          ctx.font = `600 ${eyebrowSize}px "Poppins", -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          if ('letterSpacing' in ctx) {
            (ctx as any).letterSpacing = '0.15em';
          }
          ctx.fillText(eyebrow.toUpperCase(), w / 2, h * 0.28);

          // === MAIN TITLE ===
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 1;
          const fontSize = Math.min(w * 0.05, h * 0.07);
          ctx.font = `700 ${fontSize}px "Poppins", -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if ('letterSpacing' in ctx) {
            (ctx as any).letterSpacing = '-0.02em';
          }

          ctx.shadowColor = 'rgba(0, 15, 40, 0.6)';
          ctx.shadowBlur = 24;
          ctx.shadowOffsetY = 2;

          const lineHeight = fontSize * 1.2;
          const totalHeight = title.length * lineHeight;
          const startY = h * 0.42 - totalHeight / 2 + lineHeight / 2;

          title.forEach((line, i) => {
            ctx.fillText(line, w / 2, startY + i * lineHeight);
          });

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
        }

        resolve(offscreen.toDataURL('image/png'));
      };

      img.onerror = () => {
        // Fallback gradient if image fails
        const offscreen = document.createElement('canvas');
        offscreen.width = w * dpr;
        offscreen.height = h * dpr;
        const ctx = offscreen.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.scale(dpr, dpr);

        const bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, '#0369a1');
        bg.addColorStop(0.5, '#0284c7');
        bg.addColorStop(1, '#38bdf8');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        if (showText) {
          ctx.fillStyle = '#ffffff';
          const fontSize = Math.min(w * 0.05, h * 0.07);
          ctx.font = `700 ${fontSize}px "Poppins", -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 15, 40, 0.6)';
          ctx.shadowBlur = 24;
          const lineHeight = fontSize * 1.2;
          const totalHeight = title.length * lineHeight;
          const startY = h * 0.42 - totalHeight / 2 + lineHeight / 2;
          title.forEach((line, i) => {
            ctx.fillText(line, w / 2, startY + i * lineHeight);
          });
        }

        resolve(offscreen.toDataURL('image/png'));
      };

      img.src = assetPath('/images/tile.avif');
    });
  }, [title, eyebrow, subtitle, showText]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let cleanup = false;

    generateTextImage().then((dataUrl) => {
      if (cleanup || !dataUrl) return;

      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import LiquidBackground from 'https://cdn.jsdelivr.net/npm/threejs-components@0.0.30/build/backgrounds/liquid1.min.js';
        const canvas = document.getElementById('liquid-canvas');
        if (canvas) {
          const app = LiquidBackground(canvas);
          app.loadImage('${dataUrl}');
          app.liquidPlane.material.metalness = 0.05;
          app.liquidPlane.material.roughness = 0.8;
          app.liquidPlane.uniforms.displacementScale.value = 2.0;
          app.setRain(false);
          window.__liquidApp = app;
          requestAnimationFrame(() => {
            canvas.style.opacity = '1';
          });
        }
      `;
      document.body.appendChild(script);
    });

    return () => {
      cleanup = true;
      if (window.__liquidApp && window.__liquidApp.dispose) {
        window.__liquidApp.dispose();
      }
    };
  }, [generateTextImage]);

  return (
    <canvas
      ref={canvasRef}
      id="liquid-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        touchAction: 'none',
        opacity: 0,
        transition: 'opacity 0.8s ease',
      }}
    />
  );
}
