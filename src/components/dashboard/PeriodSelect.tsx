'use client';

import { useRouter, usePathname } from 'next/navigation';
import type { Period } from '@/lib/sentinel/stats';

const OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last 365 days' },
  { value: 'all', label: 'All time' },
];

// URL-state filter — scopes every chart on the page and stays bookmarkable/shareable.
export default function PeriodSelect({ current }: { current: Period }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => router.push(`${pathname}?period=${opt.value}`)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
            current === opt.value
              ? 'bg-(--color-accent) text-(--color-accent-text) border-(--color-accent)'
              : 'text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface) border-(--color-border)'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
