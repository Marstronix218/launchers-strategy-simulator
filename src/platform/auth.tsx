import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ArrowRight, Building2, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { isCloudConfigured } from "./config";
import { supabase } from "./supabase";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  demoMode: boolean;
  continueAsDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isCloudConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [demoMode, setDemoMode] = useState(!isCloudConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (nextSession) setDemoMode(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isCloudConfigured,
      loading,
      session,
      user: session?.user ?? null,
      demoMode,
      continueAsDemo: () => setDemoMode(true),
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        setDemoMode(false);
      },
    }),
    [demoMode, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// This hook intentionally shares the component context from this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.loading) {
    return (
      <div className="auth-shell">
        <div className="auth-loading">
          <LoaderCircle className="spin" size={28} />
          <span>安全なワークスペースを確認しています…</span>
        </div>
      </div>
    );
  }
  if (auth.configured && !auth.session && !auth.demoMode) {
    return <AuthScreen />;
  }
  return <>{children}</>;
}

function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              company_name: companyName,
            },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage("確認メールを送信しました。メール内のリンクから登録を完了してください。");
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "認証に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <span>L</span>
          <strong>LAUNCHERS</strong>
        </div>
        <div>
          <span className="section-kicker light">Strategy workspace</span>
          <h1>数字を、実行可能な<br />経営戦略に変える。</h1>
          <p>
            財務三表、経営前提、シナリオ、意思決定履歴を、
            企業ごとに安全に管理します。
          </p>
        </div>
        <div className="auth-trust">
          <span><ShieldCheck size={16} /> 組織単位のデータ分離</span>
          <span><Building2 size={16} /> 監査可能な計算履歴</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-card">
          <span className="auth-lock"><KeyRound size={20} /></span>
          <span className="section-kicker">Secure access</span>
          <h2>{mode === "signin" ? "ワークスペースへログイン" : "アカウントを作成"}</h2>
          <p>
            {mode === "signin"
              ? "承認済みのメールアドレスでログインしてください。"
              : "最初のユーザーが組織オーナーになります。"}
          </p>
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label className="field">
                <span>会社・組織名</span>
                <input
                  required
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Launchers株式会社"
                />
              </label>
            )}
            <label className="field">
              <span>メールアドレス</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.jp"
                autoComplete="email"
              />
            </label>
            <label className="field">
              <span>パスワード</span>
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8文字以上"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </label>
            {error && <div className="auth-message error">{error}</div>}
            {message && <div className="auth-message success">{message}</div>}
            <button className="button primary auth-submit" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}
              {mode === "signin" ? "ログイン" : "登録する"}
            </button>
          </form>
          <button
            className="auth-switch"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setMessage("");
            }}
          >
            {mode === "signin"
              ? "初めての方はこちら"
              : "すでにアカウントをお持ちの方"}
          </button>
          <button className="auth-demo" onClick={auth.continueAsDemo}>
            データを保存せず、デモとして確認する
          </button>
        </div>
      </section>
    </div>
  );
}
