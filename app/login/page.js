import LoginForm from './LoginForm';
import { FullLogo } from '../components/Logo';

export const metadata = { title: 'Вход – Пулс графици' };

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  return (
    <main className="login-wrap">
      <div className="card login-card">
        <div className="login-head">
          <h1 className="sr-only">Денонощни аптеки „Пулс“</h1>
          <FullLogo height={72} className="login-logo" />
          <p className="muted">Система за работни графици</p>
        </div>
        {sp?.ended && (
          <div className="alert" role="status" style={{ marginBottom: '1rem' }}>
            Сесията беше прекратена (сменена парола или деактивиран профил). Моля, влезте отново.
          </div>
        )}
        {sp?.expired && (
          <div className="alert" role="status" style={{ marginBottom: '1rem' }}>
            Сесията изтече поради неактивност. Моля, влезте отново.
          </div>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
