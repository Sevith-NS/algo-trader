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
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    // Landing page scrolls via locomotive (window.scrollY stays 0); it
    // dispatches 'app:scroll' with the virtual position instead.
    const handleAppScroll = (e: Event) => {
      setScrolled(((e as CustomEvent).detail?.y ?? 0) > 20);
    };
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('app:scroll', handleAppScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('app:scroll', handleAppScroll);
    };
  }, []);

  return (
    <nav className={clsx(
      "w-full fixed top-0 z-50 transition-all duration-300 ease-in-out border-b",
      scrolled 
        ? "bg-black/80 backdrop-blur-md border-white/10 shadow-sm py-3" 
        : "bg-transparent border-transparent py-5"
    )}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-1 group">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-gray-300 transition-colors">VANGUARD</span>
              <span className="text-xl font-light text-accentGreen group-hover:text-green-400 transition-colors">OS</span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center space-x-2">
            <NavLink href="/screener" text="Terminal" />
            <NavLink href="/discover" text="Discover" />
            <NavLink href="/portfolio" text="Portfolio" />
            <NavLink href="/markets" text="Markets" />
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
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-2 py-1.5 rounded-lg transition-all"
                >
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-gray-300">
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
                      className="absolute right-0 mt-2 w-48 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl py-1 overflow-hidden"
                    >
                      <button 
                        onClick={() => {
                          setProfileOpen(false);
                          signOut({ callbackUrl: '/' });
                        }}
                        className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
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
                className="text-sm font-medium text-black bg-white hover:bg-gray-200 px-5 py-2 rounded-full transition-colors"
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
              className="inline-flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
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
            className="lg:hidden overflow-hidden border-b border-white/10 bg-[#0a0a0a]"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              <MobileNavLink href="/screener" text="Terminal" onClick={() => setIsOpen(false)} />
              <MobileNavLink href="/discover" text="Discover" onClick={() => setIsOpen(false)} />
              <MobileNavLink href="/portfolio" text="Portfolio" onClick={() => setIsOpen(false)} />
              <MobileNavLink href="/markets" text="Markets" onClick={() => setIsOpen(false)} />
              <MobileNavLink href="/news" text="News" onClick={() => setIsOpen(false)} />
              <MobileNavLink href="/geotrade" text="Geotrade" onClick={() => setIsOpen(false)} />
              <MobileNavLink href="/community" text="Community" onClick={() => setIsOpen(false)} />
              
              <div className="mt-4 pt-4 border-t border-white/10">
                {session ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-4 py-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{session.user?.name}</p>
                        <p className="text-xs text-gray-500">{session.user?.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setIsOpen(false); signOut({ callbackUrl: '/' }); }} 
                      className="w-full flex items-center gap-2 text-gray-400 hover:text-white px-4 py-2 text-sm font-medium transition-colors"
                    >
                      <LogOut size={16} /> Disconnect
                    </button>
                  </div>
                ) : (
                  <Link 
                    href="/login" 
                    onClick={() => setIsOpen(false)}
                    className="block text-center w-full bg-white text-black hover:bg-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
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

function NavLink({ href, text }: { href: string, text: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  
  return (
    <Link 
      href={href} 
      className={clsx(
        "px-4 py-2 text-sm font-medium transition-colors rounded-lg",
        isActive ? "text-white" : "text-gray-400 hover:text-gray-100"
      )}
    >
      {text}
    </Link>
  );
}

function MobileNavLink({ href, text, onClick }: { href: string, text: string, onClick: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link 
      href={href} 
      onClick={onClick}
      className={clsx(
        "block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
        isActive ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
      )}
    >
      {text}
    </Link>
  );
}
