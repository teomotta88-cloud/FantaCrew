import { ReactNode } from "react";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { PushNotificationBanner } from "@/components/PushNotificationBanner";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 md:py-10 pb-20 md:pb-10">
        <PushNotificationBanner />
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}