import React from 'react';

export const ProjectContextIcon: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 17,
}) => {
  return (
    <svg
      id="project-context-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Folder / Workspace briefcase shape with badge */}
      <rect x="3" y="6" width="18" height="15" rx="3" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <circle cx="12" cy="13" r="2.5" />
      <path d="M12 10.5v1M12 14.5v1M9.5 13h1M13.5 13h1" />
    </svg>
  );
};
