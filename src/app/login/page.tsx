import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="side-logo" style={{ marginBottom: 4 }}>
          res<span className="o">◉</span>nate
        </div>
        <div className="side-sub">TICKETING CONSOLE</div>
        <LoginForm />
      </div>
    </div>
  );
}
