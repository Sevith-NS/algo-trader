import React from 'react';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
}

export default function GradientText({
  children,
  className = '',
  colors = ['#34D399', '#22D3EE', '#60A5FA', '#22D3EE', '#34D399'],
  animationSpeed = 8,
  showBorder = false,
}: GradientTextProps) {
  const gradientStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(to right, ${colors.join(', ')})`,
    animationDuration: `${animationSpeed}s`,
  };

  return (
    <span
      className={`relative inline-flex max-w-fit flex-row items-center justify-center overflow-hidden ${
        showBorder ? 'rounded-[1.25rem] p-[2px]' : ''
      } ${className}`}
    >
      {showBorder && (
        <span
          className="pointer-events-none absolute inset-0 z-0 animate-gradient bg-cover [--bg-size:300%]"
          style={{ ...gradientStyle, backgroundSize: '300% 100%' }}
        />
      )}
      <span
        className="relative z-[2] inline-block animate-gradient bg-clip-text text-transparent [--bg-size:300%]"
        style={{ ...gradientStyle, backgroundSize: '300% 100%', WebkitBackgroundClip: 'text' }}
      >
        {children}
      </span>
    </span>
  );
}
