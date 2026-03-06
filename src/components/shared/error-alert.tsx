export function ErrorAlert({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="border border-expense/30 bg-expense/[0.06] p-4 animate-fade-in font-mono">
      <div className="flex items-start gap-3">
        <svg className="w-4 h-4 text-expense shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="flex-1">
          <p className="text-sm text-expense font-mono">{message}</p>
          {retry && (
            <button
              onClick={retry}
              className="mt-2 ticker text-expense/70 hover:text-expense transition-colors"
            >
              ↺ Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
