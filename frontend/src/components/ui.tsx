import { ReactNode, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CameraStatus, ReviewStatus } from '../types';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  width = 'max-w-lg',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center">
      <div className={`w-full ${width} animate-fade-in rounded-lg border border-line bg-ink-900 shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-mute">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} width="max-w-md">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-danger-500/10 text-danger-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm leading-relaxed text-slate-300">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
          {busy && <Spinner />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'primary';
}) {
  const toneClass = {
    neutral: 'text-slate-400 bg-ink-750 border-line',
    success: 'text-success-400 bg-success-500/10 border-success-500/20',
    danger: 'text-danger-400 bg-danger-500/10 border-danger-500/20',
    warning: 'text-warning-400 bg-warning-500/10 border-warning-500/20',
    primary: 'text-primary-400 bg-primary-500/10 border-primary-500/20',
  }[tone];

  return (
    <div className="card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-mute">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-100">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-mute">{hint}</p>}
        </div>
        {icon && (
          <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-md border ${toneClass}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-slate-600">{icon}</div>}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-mute">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-danger-400" />
      <p className="text-sm font-medium text-slate-300">Unable to load data</p>
      <p className="mt-1 max-w-md text-sm text-mute">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-4" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function CameraStatusBadge({ status, monitoring }: { status: CameraStatus; monitoring?: boolean }) {
  if (monitoring) {
    return (
      <span className="badge-green">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-400" />
        </span>
        Monitoring
      </span>
    );
  }
  if (status === 'active') return <span className="badge-green">Online</span>;
  if (status === 'error') return <span className="badge-red">Error</span>;
  if (status === 'disconnected') return <span className="badge-amber">Disconnected</span>;
  return <span className="badge-gray">Offline</span>;
}

const reviewStyles: Record<ReviewStatus, string> = {
  pending: 'badge-amber',
  confirmed: 'badge-red',
  false_positive: 'badge-green',
  dismissed: 'badge-gray',
};

const reviewLabels: Record<ReviewStatus, string> = {
  pending: 'Pending Review',
  confirmed: 'Confirmed',
  false_positive: 'False Positive',
  dismissed: 'Dismissed',
};

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return <span className={reviewStyles[status]}>{reviewLabels[status]}</span>;
}

export function reviewLabel(status: ReviewStatus): string {
  return reviewLabels[status];
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const tone =
          toast.kind === 'error'
            ? 'border-danger-500/40 bg-ink-850 text-danger-300'
            : toast.kind === 'success'
              ? 'border-success-500/40 bg-ink-850 text-success-300'
              : 'border-primary-500/40 bg-ink-850 text-primary-300';
        const Icon = toast.kind === 'error' ? AlertTriangle : toast.kind === 'success' ? CheckCircle2 : Info;
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-md border px-3.5 py-3 text-sm shadow-xl animate-fade-in ${tone}`}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-none" />
            <p className="flex-1 leading-snug text-slate-200">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-mute hover:text-slate-200"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
