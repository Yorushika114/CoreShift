'use client';

import type { ReactElement, SVGProps } from 'react';

type AppIconName =
  | 'bell'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'download'
  | 'edit'
  | 'file-calendar'
  | 'list'
  | 'mic'
  | 'plus'
  | 'refresh'
  | 'settings'
  | 'target'
  | 'upload'
  | 'volume'
  | 'volume-off';

interface AppIconProps extends SVGProps<SVGSVGElement> {
  name: AppIconName;
}

const PATHS: Record<AppIconName, ReactElement> = {
  bell: (
    <>
      <path d="M18 16H6l1.2-1.7V10a4.8 4.8 0 0 1 9.6 0v4.3L18 16Z" />
      <path d="M10 19h4" />
      <path d="M12 3v1.5" />
    </>
  ),
  calendar: (
    <>
      <path d="M7 3v3" />
      <path d="M17 3v3" />
      <path d="M4.5 8h15" />
      <rect x="4" y="5" width="16" height="15" rx="2.2" />
      <path d="M8 12h2" />
      <path d="M12 12h2" />
      <path d="M16 12h2" />
      <path d="M8 16h2" />
      <path d="M12 16h2" />
    </>
  ),
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  'chevron-down': <path d="m7 10 5 5 5-5" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  download: (
    <>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 19h14" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h8" />
      <path d="m16.5 4.5 3 3L9 18l-4 1 1-4 10.5-10.5Z" />
    </>
  ),
  'file-calendar': (
    <>
      <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5" />
      <path d="M8 12h8" />
      <path d="M9 15h2" />
      <path d="M13 15h2" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h11" />
      <path d="M8 12h11" />
      <path d="M8 18h11" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8.5 21h7" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M18.5 9A7 7 0 0 0 6.2 6.7L4 9" />
      <path d="M5.5 15A7 7 0 0 0 17.8 17.3L20 15" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h7" />
      <path d="M15 7h5" />
      <circle cx="13" cy="7" r="2" />
      <path d="M4 17h5" />
      <path d="M13 17h7" />
      <circle cx="11" cy="17" r="2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 12h.01" />
    </>
  ),
  upload: (
    <>
      <path d="M12 20V10" />
      <path d="m8 14 4-4 4 4" />
      <path d="M5 5h14" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16 9.5a4 4 0 0 1 0 5" />
      <path d="M18.5 7a7 7 0 0 1 0 10" />
    </>
  ),
  'volume-off': (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="m18 9-4 4" />
      <path d="m14 9 4 4" />
    </>
  ),
};

export function AppIcon({ name, className, ...props }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
