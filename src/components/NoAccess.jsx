import React from 'react';

/**
 * Generic "you don't have permission" panel rendered by page-level guards
 * when hasPermission(module, 'view') is false. Kept presentational only —
 * no navigation side effects so it can be embedded inside any page shell.
 */
export default function NoAccess({ module = 'this page', onGoBack }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-[14px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-[24px]">
          🔒
        </div>
        <h2 className="font-[Outfit,sans-serif] text-[18px] font-extrabold text-[#0C2340]">
          Access Denied
        </h2>
        <p className="mt-2 text-[13px] text-slate-500">
          Your role does not have permission to view <span className="font-semibold">{module}</span>.
          Contact your Super Admin to request access.
        </p>
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="mt-5 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Back to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
