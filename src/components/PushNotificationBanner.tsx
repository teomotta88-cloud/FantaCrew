import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const KEY = "fl-push-prompt-dismissed";

export function PushNotificationBanner() {
  const { user } = useAuth();
  const { supported, permission, subscribed, busy, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") setDismissed(localStorage.getItem(KEY) === "1");
  }, []);

  if (!user || !supported || subscribed || permission === "denied" || dismissed) return null;

  const dismiss = () => { localStorage.setItem(KEY, "1"); setDismissed(true); };
  const enable = async () => {
    try {
      const ok = await subscribe();
      if (ok) toast.success("Notifiche attivate");
      else toast.error("Permesso negato");
    } catch (e: any) {
      toast.error(e.message || "Errore attivazione");
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 left-2 right-2 md:left-auto md:right-4 md:max-w-sm z-40 pointer-events-none">
      <Card className="p-3 border-primary/30 bg-background shadow-lg flex items-center gap-2 pointer-events-auto">
        <Bell className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 text-xs">
          Notifiche su mercato, classifica e azioni speciali 🏉
        </div>
        <Button size="sm" onClick={enable} disabled={busy}>Attiva</Button>
        <Button size="sm" variant="ghost" onClick={dismiss} aria-label="Chiudi"><X className="h-4 w-4" /></Button>
      </Card>
    </div>
  );
}