interface Step {
  letter: string;
  label: string;
}

const STEPS: Step[] = [
  { letter: 'A', label: 'Patient' },
  { letter: 'B', label: 'Visit' },
  { letter: 'C', label: 'Bill' },
];

export function LedgerSteps({ current }: { current: number }) {
  return (
    <div className="ledger-steps">
      {STEPS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : '';
        return (
          <div key={step.letter} className={`ledger-step ${state ? `ledger-step--${state}` : ''}`}>
            <span className="ledger-step__letter">{step.letter}</span>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
