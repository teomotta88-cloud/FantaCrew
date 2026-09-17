import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageShell } from "@/components/layout/PageShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayersAdmin } from "@/components/admin/PlayersAdmin";
import { CoachesAdmin } from "@/components/admin/CoachesAdmin";
import { RulesAdmin } from "@/components/admin/RulesAdmin";
import { EventsAdmin } from "@/components/admin/EventsAdmin";
import { ActionsAdmin } from "@/components/admin/ActionsAdmin";
import { TrainingsAdmin } from "@/components/admin/TrainingsAdmin";
import { MatchesAdmin } from "@/components/admin/MatchesAdmin";
import { TeamConfigAdmin } from "@/components/admin/TeamConfigAdmin";
import { MandatoryAdmin } from "@/components/admin/MandatoryAdmin";
import { NotificationsAdmin } from "@/components/admin/NotificationsAdmin";
import { SeasonsAdmin } from "@/components/admin/SeasonsAdmin";
import { CategoriesAdmin } from "@/components/admin/CategoriesAdmin";
import { AdminsAdmin } from "@/components/admin/AdminsAdmin";
import { BadgesAdmin } from "@/components/admin/BadgesAdmin";
import { useAdminPermissions } from "@/contexts/AdminPermissionsContext";
import { Card } from "@/components/ui/card";

const ALL_TABS = [
  { value: "players", label: "👥 Giocatori" },
  { value: "coaches", label: "🏋️ Allenatori" },
  { value: "trainings", label: "📅 Allenamenti" },
  { value: "matches", label: "🏉 Partite" },
  { value: "events", label: "📊 Eventi settimanali" },
  { value: "actions", label: "⚡ Azioni speciali" },
  { value: "rules", label: "🔢 Punteggi" },
  { value: "quotas", label: "⚙️ Quote squadra" },
  { value: "categories", label: "🏷️ Categorie" },
  { value: "mandatory", label: "🔒 Obbligatorietà" },
  { value: "notifications", label: "🔔 Notifiche" },
  { value: "seasons", label: "🏆 Stagioni" },
  { value: "admins", label: "👥 Admin e TM" },
  { value: "badges", label: "🏅 Badge" },
];

export const Route = createFileRoute("/$crewSlug/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Fanta Lambro" }] }),
});

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const { canAccessTab, loading: permLoading } = useAdminPermissions();
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>("players");
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);
  const TABS = ALL_TABS.filter((t) => canAccessTab(t.value));
  useEffect(() => {
    if (!permLoading && !canAccessTab(tab) && TABS.length > 0) setTab(TABS[0].value);
  }, [permLoading, tab, canAccessTab, TABS]);

  if (loading)
    return (
      <PageShell>
        <div>…</div>
      </PageShell>
    );
  if (!isAdmin)
    return (
      <PageShell>
        <Card className="p-8 text-center max-w-md mx-auto">
          <h2 className="text-xl font-bold mb-2">Accesso riservato</h2>
          <p className="text-sm text-muted-foreground mb-4">Solo gli admin possono accedere a questa pagina.</p>
          <p className="text-xs text-muted-foreground">
            Se il ruolo ti è stato appena assegnato, aggiorna la pagina o esci e rientra. Su una nuova installazione, il
            primo utente autenticato viene promosso automaticamente.
          </p>
        </Card>
      </PageShell>
    );

  return (
    <PageShell>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Gestisci giocatori, punti, eventi e azioni speciali.</p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="md:hidden mb-4">
          <Select value={tab} onValueChange={setTab}>
            <SelectTrigger className="w-full min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TabsList className="hidden md:flex flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="players" className="mt-6">
          <PlayersAdmin />
        </TabsContent>
        <TabsContent value="coaches" className="mt-6">
          <CoachesAdmin />
        </TabsContent>
        <TabsContent value="trainings" className="mt-6">
          <TrainingsAdmin />
        </TabsContent>
        <TabsContent value="matches" className="mt-6">
          <MatchesAdmin />
        </TabsContent>
        <TabsContent value="events" className="mt-6">
          <EventsAdmin />
        </TabsContent>
        <TabsContent value="actions" className="mt-6">
          <ActionsAdmin />
        </TabsContent>
        <TabsContent value="rules" className="mt-6">
          <RulesAdmin />
        </TabsContent>
        <TabsContent value="quotas" className="mt-6">
          <TeamConfigAdmin />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesAdmin />
        </TabsContent>
        <TabsContent value="mandatory" className="mt-6">
          <MandatoryAdmin />
        </TabsContent>
        <TabsContent value="notifications" className="mt-6">
          <NotificationsAdmin />
        </TabsContent>
        <TabsContent value="seasons" className="mt-6">
          <SeasonsAdmin />
        </TabsContent>
        <TabsContent value="admins" className="mt-6">
          <AdminsAdmin />
        </TabsContent>
        <TabsContent value="badges" className="mt-6">
          <BadgesAdmin />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
