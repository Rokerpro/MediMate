"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const HIDE_AFTER_SCROLL = 80;
const SCROLL_DIRECTION_THRESHOLD = 6;

export function ScrollAwareHeader({
  children,
  className = "",
  spacerClassName,
}: {
  children: ReactNode;
  className?: string;
  spacerClassName: string;
}) {
  const pathname = usePathname();

  return (
    <ScrollAwareHeaderFrame
      key={pathname}
      className={className}
      spacerClassName={spacerClassName}
    >
      {children}
    </ScrollAwareHeaderFrame>
  );
}

function ScrollAwareHeaderFrame({
  children,
  className,
  spacerClassName,
}: {
  children: ReactNode;
  className: string;
  spacerClassName: string;
}) {
  const [isHidden, setIsHidden] = useState(false);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const header = headerRef.current;

    if (!header) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setHeaderHeight(header.getBoundingClientRect().height);
    });

    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      if (currentScrollY <= HIDE_AFTER_SCROLL || scrollDelta < -SCROLL_DIRECTION_THRESHOLD) {
        setIsHidden(false);
      } else if (scrollDelta > SCROLL_DIRECTION_THRESHOLD) {
        setIsHidden(true);
      }

      lastScrollY.current = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className={spacerClassName}
        style={headerHeight === null ? undefined : { height: headerHeight }}
      />
      <header
        ref={headerRef}
        className={`${className} fixed inset-x-0 top-0 z-40 transition-transform duration-300 motion-reduce:transition-none`}
        onFocusCapture={() => setIsHidden(false)}
        style={{ transform: isHidden ? "translateY(-100%)" : "translateY(0)" }}
      >
        {children}
      </header>
    </>
  );
}
