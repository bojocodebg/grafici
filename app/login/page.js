import LoginForm from './LoginForm';
import Logo from '../components/Logo';

export const metadata = { title: 'Вход – Пулс графици' };

export default function LoginPage() {
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
        <LoginForm />
      </div>
    </main>
  );
}
