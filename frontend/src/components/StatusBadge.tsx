import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  CREATED_MERCHANT_MGT: 'Nouveau',
  AFFILIATION_CREATED: 'Pris en charge',
  TEST_PARAMS_SENT: 'Param. test envoyés',
  TESTS_VALIDATED: 'Tests validés',
  PROD_PARAMS_SENT: 'Param. prod envoyés',
  IN_PRODUCTION: 'En production',
};

const STATUS_COLORS: Record<string, string> = {
  CREATED_MERCHANT_MGT: 'bg-slate-200 text-slate-800',
  AFFILIATION_CREATED: 'bg-blue-100 text-blue-800',
  TEST_PARAMS_SENT: 'bg-amber-100 text-amber-800',
  TESTS_VALIDATED: 'bg-cyan-100 text-cyan-800',
  PROD_PARAMS_SENT: 'bg-violet-100 text-violet-800',
  IN_PRODUCTION: 'bg-green-100 text-green-800',
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-1';
  return (
    <span className={cn('inline-flex rounded-full font-medium', color, sizeClass, className)}>
      {label}
    </span>
  );
}
