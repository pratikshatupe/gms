import React, { useState, useEffect, useRef } from 'react';

export function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

export function FadeIn({ children, delay = 0, style: extraStyle = {} }) {
  const [ref, v] = useInView();
  return (
    <div ref={ref} style={{
      opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(24px)',
      transition: `opacity .6s ${delay}s cubic-bezier(.22,1,.36,1), transform .6s ${delay}s cubic-bezier(.22,1,.36,1)`,
      ...extraStyle,
    }}>{children}</div>
  );
}

export function Counter({ val, suffix = '' }) {
  const [cur, setCur] = useState(0);
  const [ref, v] = useInView(0.3);
  useEffect(() => {
    if (!v) return;
    const target = parseFloat(val), dur = 1800, step = 16;
    const inc = target / (dur / step); let c = 0;
    const t = setInterval(() => { c = Math.min(c + inc, target); setCur(c); if (c >= target) clearInterval(t); }, step);
    return () => clearInterval(t);
  }, [v, val]);
  return <span ref={ref}>{Number.isInteger(parseFloat(val)) ? Math.round(cur).toLocaleString() : cur.toFixed(1)}{suffix}</span>;
}
