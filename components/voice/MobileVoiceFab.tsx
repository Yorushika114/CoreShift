'use client';

import { AppIcon } from '@/components/ui/AppIcon';

interface MobileVoiceFabProps {
  label: string;
  onClick: () => void;
}

export function MobileVoiceFab({ label, onClick }: MobileVoiceFabProps) {
  return (
    <div
      data-testid="mobile-voice-fab"
      className="fixed bottom-6 right-5 z-[100] md:hidden"
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex min-h-14 items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-900/20 transition active:scale-[0.98]"
      >
        <AppIcon name="mic" className="h-5 w-5" />
        <span>{label}</span>
      </button>
    </div>
  );
}
