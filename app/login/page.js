import LoginForm from './LoginForm';
import Logo from '../components/Logo';

export const metadata = { title: 'Вход – Пулс графици' };

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  return (
    <main className="login-wrap">
      <div className="card login-card">
        <div className="login-head">
          <Logo size={48} />
          <div>
            <h1>Денонощни аптеки „Пулс“</h1>
            <p className="muted">Система за работни графици</p>
          </div>
        </div>
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
