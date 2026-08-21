'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Menu, X, User, ChevronDown, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    // Lenis drives native scroll, so window.scrollY is truthful on every route
    // (the old locomotive rig pinned it at 0 and needed an 'app:scroll' bridge).
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll(); // reflect position on mount, e.g. after a refresh mid-page
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={clsx(
      "w-full fixed top-0 z-50 border-b transition-[background-color,border-color,padding] duration-200 ease-out",
      scrolled 
        ? "bg-bgPrimary/85 backdrop-blur-md border-borderSubtle py-3" 
        : "bg-transparent border-transparent py-5"
    )}>
      {/* Container mirrors PageShell exactly (max-w + px), so the wordmark lines
          up with each page's content column instead of floating inside it. */}
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-1 group">
              <span className="font-mono text-xl font-bold tracking-tight text-textPrimary transition-colors group-hover:text-textSecondary">VANGUARD</span>
              <span className="font-mono text-xl font-light text-accentGreen transition-colors">OS</span>
            </Link>
          </div>

          {/* Desktop Menu */}
          {/* Six items, down from eight: Movers and Discover were separate
              top-level destinations answering the same question as Markets, so
              they now live behind Markets' view strip (see MarketsTabs). Six
              plus logo and auth clear 1024px with room to spare, which is why
              the per-item padding could go back up to something comfortable. */}
          <div className="hidden lg:flex items-center gap-1">
            <NavLink href="/screener" text="Terminal" />
            <NavLink href="/markets" text="Markets" matches={['/movers', '/discover']} />
            <NavLink href="/portfolio" text="Portfolio" />
            <NavLink href="/news" text="News" />
            <NavLink href="/geotrade" text="Geotrade" />
            <NavLink href="/community" text="Community" />
          </div>

          {/* User Auth Section */}
          <div className="hidden lg:flex items-center gap-4">
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-textSecondary transition-colors hover:text-textPrimary"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.08] text-textSecondary">
                    <User size={12} />
                  </div>
                  <span className="max-w-[14ch] truncate font-medium">{session.user?.name}</span>
                  <ChevronDown size={14} className={clsx("transition-transform duration-200", profileOpen && "rotate-180")} />
                </button>
                
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-borderSubtle bg-bgSecondary py-1 shadow-card"
                    >
                      <button 
                        onClick={() => {
                          setProfileOpen(false);
                          signOut({ callbackUrl: '/' });
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-textSecondary transition-colors hover:bg-white/5 hover:text-textPrimary"
                      >
                        <LogOut size={14} /> Disconnect
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link 
                href="/login" 
                className="rounded-full bg-textPrimary px-5 py-2 text-sm font-semibold text-bgPrimary transition-colors hover:bg-white"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              className="inline-flex items-center justify-center rounded-lg p-2 text-textSecondary transition-colors hover:text-textPrimary"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-borderSubtle bg-bgSecondary lg:hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              <MobileNavLink href="/screener" text="Terminal" onClick={() => setIsOpen(false)} />
              {/* Markets' five views are listed rather than hidden behind the
                  parent: on a phone the in-page view strip is one more scroll
                  away, and a drawer is the one place with room to show the
                  whole section at once. Indented so the nesting is legible
                  without a second visual style. */}
              <MobileNavLink
                href="/markets"
                text="Markets"
                matches={['/movers', '/discover']}
                onClick={() => setIsOpen(false)}
              />
              <div className="ml-3 space-y-0.5 border-l border-borderSubtle pl-3">
                <MobileNavLink href="/markets" text="Heat" exact onClick={() => setIsOpen(false)} />
                <MobileNavLink href="/movers" text="Movers" onClick={() => setIsOpen(false)} />
                <MobileNavLink href="/discover?tab=ideas" text="Ideas" onClick={() => setIsOpen(false)} />
                <MobileNavLink href="/discover?tab=levels" text="Levels" onClick={() => setIsOpen(false)} />
                <MobileNavLink href="/discover?tab=screens" text="Screens" onClick={() => setIsOpen(false)} />
              </div>
              <MobileNavLink href="/portfolio" text="Portfolio" onClick={() => setIsOpen(false)} />
              <MobileNavLink href="/news" text="News" onClick={() => setIsOpen(false)} />
              <MobileNavLink href="/geotrade" text="Geotrade" onClick={() => setIsOpen(false)} />
              <MobileNavLink href="/community" text="Community" onClick={() => setIsOpen(false)} />
              
              <div className="mt-4 border-t border-borderSubtle pt-4">
                {session ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-4 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-textSecondary">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-textPrimary">{session.user?.name}</p>
                        <p className="text-xs text-textMuted">{session.user?.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setIsOpen(false); signOut({ callbackUrl: '/' }); }} 
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-textSecondary transition-colors hover:text-textPrimary"
                    >
                      <LogOut size={16} /> Disconnect
                    </button>
                  </div>
                ) : (
                  <Link 
                    href="/login" 
                    onClick={() => setIsOpen(false)}
                    className="block w-full rounded-xl bg-textPrimary px-4 py-2.5 text-center text-sm font-semibold text-bgPrimary transition-colors hover:bg-white"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/**
 * Whether a nav entry owns the current route.
 *
 * `matches` exists because Markets is now a section, not a page: standing on
 * /movers or /discover the bar must still show Markets as the place you are,
 * or the collapse from eight items to six reads as "my page disappeared".
 */
function useNavActive(href: string, matches: string[] = [], exact = false) {
  const pathname = usePathname();
  const base = href.split('?')[0];
  if (exact) return pathname === base;
  const owns = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  return owns(base) || matches.some(owns);
}

function NavLink({ href, text, matches }: {
  href: string;
  text: React.ReactNode;
  matches?: string[];
}) {
  const isActive = useNavActive(href, matches);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={clsx(
        // Nav labels are chrome, not prose, so they sit in mono with the rest
        // of the interface furniture. JetBrains Mono runs narrower than the
        // face this replaced, which is what bought back the per-item padding.
        // `relative` is for the active underline below.
        "relative px-3.5 py-2 font-mono text-[13px] font-medium tracking-tight rounded-lg whitespace-nowrap transition-colors duration-150",
        isActive ? "text-textPrimary" : "text-textSecondary hover:bg-white/[0.04] hover:text-textPrimary"
      )}
    >
      {text}
      {/* Active state carried on two channels, not one: colour alone was a
          #94A3B8 → #F1F5F9 shift that is easy to miss mid-scan, and invisible
          to anyone who cannot separate the two greys. The rule is the second
          channel. It is 2px and inset from the label so it reads as a marker
          rather than an underlined link. */}
      {isActive && (
        <span
          aria-hidden
          className="absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-accentGreen"
        />
      )}
    </Link>
  );
}

function MobileNavLink({ href, text, onClick, matches, exact }: {
  href: string;
  text: string;
  onClick: () => void;
  matches?: string[];
  /** Match this exact path only — needed for Heat, whose /markets is also the section root. */
  exact?: boolean;
}) {
  const isActive = useNavActive(href, matches, exact);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={clsx(
        // min-h-11 is the 44px touch target; the drawer previously shipped
        // ~38px rows, which is under every platform's minimum.
        "flex min-h-11 items-center rounded-lg px-4 font-mono text-[13px] font-medium transition-colors duration-150",
        isActive ? "bg-white/[0.08] text-textPrimary" : "text-textSecondary hover:bg-white/5 hover:text-textPrimary"
      )}
    >
      {text}
    </Link>
  );
}
