'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface TerminalLine {
  type: 'command' | 'output' | 'blank';
  text: string;
  color?: string;
}

const SEQUENCES: TerminalLine[][] = [
  [
    { type: 'command', text: 'fsight --analyze portfolio' },
    { type: 'output', text: 'Scanning 3 accounts...' },
    { type: 'output', text: 'Checking: 401(k)        $48,230.00  +12.4% YTD', color: 'text-income' },
    { type: 'output', text: 'Savings:  HYSA          $15,800.00  +4.5% APY', color: 'text-income' },
    { type: 'output', text: 'Broker:   Index Funds   $22,150.00  +8.2% YTD', color: 'text-income' },
    { type: 'output', text: 'Total portfolio value: $86,180.00', color: 'text-primary' },
    { type: 'blank', text: '' },
  ],
  [
    { type: 'command', text: 'fsight budget --month march' },
    { type: 'output', text: 'Loading budget for 2026-03...' },
    { type: 'output', text: 'Housing      $1,800 / $1,800  [##########] 100%', color: 'text-expense' },
    { type: 'output', text: 'Groceries    $  420 / $  600  [#######---]  70%', color: 'text-yellow-400' },
    { type: 'output', text: 'Transport    $  180 / $  350  [#####-----]  51%', color: 'text-income' },
    { type: 'output', text: 'Dining       $   95 / $  200  [####------]  48%', color: 'text-income' },
    { type: 'output', text: 'Remaining discretionary: $1,105.00', color: 'text-primary' },
    { type: 'blank', text: '' },
  ],
  [
    { type: 'command', text: 'fsight cashflow --forecast 6m' },
    { type: 'output', text: 'Projecting cash flow...' },
    { type: 'output', text: 'Apr 2026   +$2,340   Net savings', color: 'text-income' },
    { type: 'output', text: 'May 2026   +$1,890   Net savings', color: 'text-income' },
    { type: 'output', text: 'Jun 2026   -$  450   Insurance due', color: 'text-expense' },
    { type: 'output', text: 'Jul 2026   +$2,100   Net savings', color: 'text-income' },
    { type: 'output', text: 'Aug 2026   +$2,340   Net savings', color: 'text-income' },
    { type: 'output', text: 'Sep 2026   +$1,200   Vacation adj.', color: 'text-yellow-400' },
    { type: 'output', text: '6-month projection: +$9,420.00', color: 'text-primary' },
    { type: 'blank', text: '' },
  ],
  [
    { type: 'command', text: 'fsight debt --payoff-plan' },
    { type: 'output', text: 'Calculating optimal payoff (avalanche)...' },
    { type: 'output', text: 'Credit Card   $3,200  @22.9%  -> Pay $640/mo  [5 mo]', color: 'text-expense' },
    { type: 'output', text: 'Auto Loan    $12,400  @ 5.4%  -> Pay $380/mo  [36 mo]', color: 'text-yellow-400' },
    { type: 'output', text: 'Student Loan $18,600  @ 4.2%  -> Pay $220/mo  [96 mo]', color: 'text-muted-foreground' },
    { type: 'output', text: 'Interest saved vs minimum: $4,820', color: 'text-income' },
    { type: 'blank', text: '' },
  ],
  [
    { type: 'command', text: 'fsight goals --status' },
    { type: 'output', text: 'Fetching savings goals...' },
    { type: 'output', text: 'Emergency Fund    $12,000 / $15,000  [########--]  80%', color: 'text-income' },
    { type: 'output', text: 'Vacation Fund     $ 1,800 / $ 3,000  [######----]  60%', color: 'text-yellow-400' },
    { type: 'output', text: 'Down Payment      $ 8,500 / $40,000  [##--------]  21%', color: 'text-expense' },
    { type: 'output', text: 'On track for Emergency Fund by May 2026', color: 'text-primary' },
    { type: 'blank', text: '' },
  ],
  [
    { type: 'command', text: 'fsight transactions --recent --limit 5' },
    { type: 'output', text: 'Loading recent transactions...' },
    { type: 'output', text: 'Mar 07  -$  42.30  Whole Foods        Groceries', color: 'text-expense' },
    { type: 'output', text: 'Mar 06  -$ 128.00  Electric Company   Utilities', color: 'text-expense' },
    { type: 'output', text: 'Mar 05  +$3,400.00 Employer Inc       Income', color: 'text-income' },
    { type: 'output', text: 'Mar 04  -$  15.99  Netflix            Subscriptions', color: 'text-expense' },
    { type: 'output', text: 'Mar 03  -$  67.50  Shell Gas          Transport', color: 'text-expense' },
    { type: 'blank', text: '' },
  ],
  [
    { type: 'command', text: 'fsight networth --snapshot' },
    { type: 'output', text: 'Calculating net worth...' },
    { type: 'output', text: 'Assets:       $112,430.00', color: 'text-income' },
    { type: 'output', text: 'Liabilities:  $ 34,200.00', color: 'text-expense' },
    { type: 'output', text: '----------------------------' },
    { type: 'output', text: 'Net Worth:    $ 78,230.00', color: 'text-primary' },
    { type: 'output', text: 'Change (30d): +$2,140.00  (+2.8%)', color: 'text-income' },
    { type: 'blank', text: '' },
  ],
];

const TYPING_SPEED = 35;
const OUTPUT_DELAY = 120;
const SEQUENCE_PAUSE = 1800;
const MAX_VISIBLE_LINES = 18;

// Custom event for demo mode toggle
export const TERMINAL_DEMO_EVENT = 'terminal-demo-toggle';

export function TerminalAnimation() {
  const [lines, setLines] = useState<{ text: string; color?: string; isCommand: boolean }[]>([]);
  const [currentTyping, setCurrentTyping] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }, []);

  useEffect(() => {
    const ctrl = { cancelled: false };
    animationRef.current = ctrl;

    async function runAnimation() {
      let seqIndex = 0;

      while (!ctrl.cancelled) {
        const sequence = SEQUENCES[seqIndex % SEQUENCES.length];

        for (const line of sequence) {
          if (ctrl.cancelled) return;

          if (line.type === 'blank') {
            await sleep(300);
            continue;
          }

          if (line.type === 'command') {
            const prefix = '$ ';
            for (let i = 0; i <= line.text.length; i++) {
              if (ctrl.cancelled) return;
              setCurrentTyping(prefix + line.text.slice(0, i));
              await sleep(TYPING_SPEED + Math.random() * 20);
            }
            await sleep(200);
            setLines(prev => {
              const next = [...prev, { text: prefix + line.text, isCommand: true }];
              return next.slice(-MAX_VISIBLE_LINES);
            });
            setCurrentTyping('');
            await sleep(400);
          } else {
            await sleep(OUTPUT_DELAY + Math.random() * 80);
            setLines(prev => {
              const next = [...prev, { text: '  ' + line.text, color: line.color, isCommand: false }];
              return next.slice(-MAX_VISIBLE_LINES);
            });
          }
        }

        seqIndex++;
        await sleep(SEQUENCE_PAUSE);
      }
    }

    runAnimation();

    return () => {
      ctrl.cancelled = true;
    };
  }, [sleep]);

  // Demo mode toggle listener
  useEffect(() => {
    const handler = () => setDemoMode(v => !v);
    window.addEventListener(TERMINAL_DEMO_EVENT, handler);
    return () => window.removeEventListener(TERMINAL_DEMO_EVENT, handler);
  }, []);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => setShowCursor(v => !v), 530);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, currentTyping]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div
        ref={containerRef}
        className={`absolute inset-0 p-6 pt-20 pb-32 overflow-hidden font-mono text-[11px] leading-[1.7] transition-opacity duration-500 ${demoMode ? 'opacity-80' : 'opacity-[0.12]'}`}
      >
        {lines.map((line, i) => (
          <div key={i} className={line.color || (line.isCommand ? 'text-primary' : 'text-foreground')}>
            {line.text}
          </div>
        ))}
        {currentTyping && (
          <div className="text-primary">
            {currentTyping}
            <span className={showCursor ? 'opacity-100' : 'opacity-0'}>_</span>
          </div>
        )}
        {!currentTyping && (
          <div className="text-primary">
            $ <span className={showCursor ? 'opacity-100' : 'opacity-0'}>_</span>
          </div>
        )}
      </div>
    </div>
  );
}
