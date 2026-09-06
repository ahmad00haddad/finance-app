import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, UserRound } from "lucide-react";

export const STORAGE_KEY = "app_unlocked_v1";
const PASSWORD = "Ahmad12345";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      setUnlocked(val === "1" || val === "guest");
    } catch {
      setUnlocked(false);
    }
  }, []);

  if (unlocked === null) return null;
  if (unlocked) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === PASSWORD) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  const loginAsGuest = () => {
    try { localStorage.setItem(STORAGE_KEY, "guest"); } catch { /* noop */ }
    setUnlocked(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-glow overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="h-14 w-14 rounded-2xl bg-brand-gradient flex items-center justify-center text-primary-foreground shadow-glow">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-center text-lg font-bold">مرحباً 👋</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">أدخل كلمة السر للمتابعة</p>
          
          <form onSubmit={submit} className="w-full">
            <Input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(false); }}
              className="mt-6 text-center bg-secondary border-border focus-visible:ring-primary"
              placeholder="••••••••"
            />
            {error && <p className="mt-2 text-center text-xs text-expense">كلمة السر غير صحيحة</p>}
            <Button type="submit" className="mt-4 w-full bg-brand-gradient text-primary-foreground hover:opacity-90">دخول</Button>
          </form>

          <div className="relative w-full my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">أو للزوار</span></div>
          </div>

          <Button type="button" variant="outline" onClick={loginAsGuest} className="w-full flex items-center gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary">
            <UserRound className="h-4 w-4" />
            تجربة النظام كضيف
          </Button>
        </div>
      </div>
    </div>
  );
}

