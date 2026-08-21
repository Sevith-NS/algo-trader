'use client';

import { SessionProvider } from 'next-auth/react';
import { MotionConfig } from 'framer-motion';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* reducedMotion="user": framer-motion auto-disables transform/layout
          animations app-wide when the OS asks for reduced motion */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </SessionProvider>
  );
}
