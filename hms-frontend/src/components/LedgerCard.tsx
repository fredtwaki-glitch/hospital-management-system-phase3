import { ReactNode } from 'react';

interface LedgerCardProps {
  tabLabel: string;
  stampText?: string;
  stampVariant?: 'active' | 'pending' | 'alert';
  children: ReactNode;
}

export function LedgerCard({ tabLabel, stampText, stampVariant = 'active', children }: LedgerCardProps) {
  return (
    <div className="ledger-card">
      <span className="ledger-card__tab">{tabLabel}</span>
      {stampText && <span className={`ledger-card__stamp ledger-card__stamp--${stampVariant}`}>{stampText}</span>}
      {children}
    </div>
  );
}

/** Maps backend status strings to a stamp visual variant, per record type. */
export function stampVariantForStatus(status: string): 'active' | 'pending' | 'alert' {
  const activeStates = ['paid', 'completed', 'approved', 'active', 'checked_in'];
  const alertStates = ['rejected', 'cancelled', 'no_show', 'void', 'suspended'];
  if (activeStates.includes(status)) return 'active';
  if (alertStates.includes(status)) return 'alert';
  return 'pending';
}
