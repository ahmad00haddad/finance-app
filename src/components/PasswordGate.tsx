import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

const STORAGE_KEY = "app_unlocked_v1";
const PASSWORD = "Ahmad12345";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setUnlocked(localStorage.getItem(STORAGE_KEY) === "1");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-glow">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-gradient flex items-center justify-center text-primary-foreground shadow-glow">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-lg font-bold">مرحباً 👋</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">أدخل كلمة السر للمتابعة</p>
        <Input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          className="mt-5 text-center"
          placeholder="••••••••"
        />
        {error && <p className="mt-2 text-center text-xs text-expense">كلمة السر غير صحيحة</p>}
        <Button type="submit" className="mt-4 w-full">دخول</Button>
      </form>
    </div>
  );
}