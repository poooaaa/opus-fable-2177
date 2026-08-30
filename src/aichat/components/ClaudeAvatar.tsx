import React from 'react';

interface ClaudeAvatarProps {
  size?: number;
  className?: string;
}

export const ClaudeAvatar: React.FC<ClaudeAvatarProps> = ({ size = 36, className = '' }) => {
  return (
    <div
      id="claude-avatar-container"
      className={`rounded-[10px] bg-[#d7573b] flex items-center justify-center shrink-0 select-none shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        id="claude-mascot-svg"
        viewBox="0 0 16 16"
        className="w-[20px] h-[20px] fill-white"
        shapeRendering="crispEdges"
      >
        {/* Claude 8-bit Pixel Robot Mascot */}
        {/* Top horns / ears */}
        <rect x="2" y="2" width="2" height="3" />
        <rect x="12" y="2" width="2" height="3" />

        {/* Main upper head bar */}
        <rect x="4" y="3" width="8" height="2" />
        <rect x="2" y="5" width="12" height="6" />

        {/* Eye cutouts (negative space) */}
        <rect x="5" y="6" width="2" height="2" fill="#d7573b" />
        <rect x="9" y="6" width="2" height="2" fill="#d7573b" />

        {/* Mouth/center cutout */}
        <rect x="7" y="9" width="2" height="1" fill="#d7573b" />

        {/* Feet */}
        <rect x="3" y="11" width="2" height="2" />
        <rect x="11" y="11" width="2" height="2" />
      </svg>
    </div>
  );
};
