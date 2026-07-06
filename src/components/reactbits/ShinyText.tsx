import React from 'react';

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export default function ShinyText({ text, disabled = false, speed = 5, className = '' }: ShinyTextProps) {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${disabled ? '' : 'animate-shine'} ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(120deg, rgba(148, 163, 184, 0.75) 40%, rgba(241, 245, 249, 1) 50%, rgba(148, 163, 184, 0.75) 60%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        animationDuration: `${speed}s`,
      }}
    >
      {text}
    </span>
  );
}
