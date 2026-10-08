"use client";

import { Menu, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Wordmark } from "@/features/public/components/Wordmark";
import { content } from "@/features/public/content";

// Fixed pill nav: hides when scrolling down past the hero, comes back on
// the way up, turns dark over the payments-abroad section, and folds into
// a menu on phones. One passive scroll listener, at most one update per
// frame.
export function SiteNav({ chatHref }: { chatHref: string }) {
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const dark = document.getElementById("world");
    let lastY = window.scrollY;
    let queued = 0;
    const update = () => {
      queued = 0;
      const y = window.scrollY;
      if (y > lastY + 2 && y > 300) el.classList.add("hide");
      else if (y < lastY - 2) el.classList.remove("hide");
      lastY = y;
      if (dark) {
        const r = dark.getBoundingClientRect();
        el.classList.toggle("dark", r.top < 60 && r.bottom > 60);
      }
    };
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(queued);
    };
  }, []);

  return (
    <header className="nav" ref={nav}>
      <div className="wrap bar">
        <a href="#top" aria-label={`${content.brand} home`}>
          <Wordmark />
        </a>
        <nav
          className={`links${open ? " open" : ""}`}
          id="site-links"
          aria-label="Main"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {content.nav.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <a
          className="btn vio sm mag"
          href={chatHref}
          target="_blank"
          rel="noopener"
        >
          <MessageCircle strokeWidth={2.2} aria-hidden="true" />
          Chat with us
        </a>
        <button
          type="button"
          className="menu"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-links"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <X size={22} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Menu size={22} strokeWidth={2.2} aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
