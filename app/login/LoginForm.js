'use client';
import { useActionState } from 'react';
import { login } from './actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="stack">
      {state?.error && <div className="alert error">{state.error}</div>}
      <label>
        Потребителско име
        <input name="username" autoComplete="username" required autoFocus defaultValue={state?.username || ''} key={state?.username} />
      </label>
      <label>
        Парола
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="btn primary" disabled={pending}>{pending ? 'Влизане…' : 'Вход'}</button>
    </form>
  );
}
