'use client';
import { useFormStatus } from 'react-dom';

export default function SubmitButton({ children, className = 'btn primary', confirm, disabled, ...rest }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={pending || !!disabled}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
      {...rest}
    >
      {pending ? '…' : children}
    </button>
  );
}
