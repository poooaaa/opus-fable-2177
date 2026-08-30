import React from 'react';

interface CopyIconProps {
  className?: string;
  size?: number;
}

export const ClaudeCopyIcon: React.FC<CopyIconProps> = ({ className = '', size = 18 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={`shrink-0 ${className}`}
    >
      {/* Front right square - sharp 90-degree corners */}
      <rect x="6.5" y="2.5" width="11" height="11" />
      
      {/* Back bottom-left L-bracket - sharp 90-degree corner */}
      <path d="M2.5 6.5v11h11" strokeWidth="2" />
    </svg>
  );
};
