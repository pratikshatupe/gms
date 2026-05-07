import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * EmptyState — canonical "no data" block for tables and lists.
 * Default message is "No records found." (with full stop) per QA spec.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  message = 'No records found.',
  description,
  action,
  className = '',
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-2 py-12 px-4 text-center ${className}`}
    >
      {Icon && (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-[#1E1E3F] dark:text-slate-500">
          <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
        </div>
      )}
      <p className="text-[14px] font-semibold text-slate-500 dark:text-slate-300">
        {message}
      </p>
      {description && (
        <p className="max-w-sm text-[12px] text-slate-400 dark:text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
