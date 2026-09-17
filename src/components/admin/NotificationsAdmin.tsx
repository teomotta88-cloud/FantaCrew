import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Trash2, Save } from "lucide-react";

type Template = {
  id: string;
  title: string;
  push_title: string;
  push_body: string;
  push_url: string | null;
  type: "recurring" | "one_time" | "event_triggered";
  is_active: boolean;
  audience: string;
  cron_expression: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  event_trigger: string | null;
  send_hour: number | null;
  send_minute: number | null;
};

type LogRow = {
  id: string;
  template_id: string | null;
  sent_at: string;
  audience: string;
  recipient_count: number;
  success_count: number;
  failure_count: number;
  payload: any;
};

const audiences = [
  { value: "all", label: "Tutti" },
  { value: "active_teams", label: "Squadre attive" },
  { value: "invalid_teams", label: "Squadre non valide" },
];

const eventLabels: Record<string, string> = {
  market_open: "Apertura mercato",
  market_close_warning: "Chiusura mercato −24h",
  snapshot_saved: "Snapshot classifica",
  repricing_done: "Repricing Zaghetti",
  mandatory_active: "Obbligatorietà attiva",
  mandatory_expiry_warning: "Warning obbligatorietà",
  special_action_published: "Azione speciale",
};

function lastSentMap(logs: LogRow[]) {
  const m = new Map<string, string>();
  for (const l of logs) {
    if (!l.template_id) continue;
    if (!m.has(l.template_id)) m.set(l.template_id, l.sent_at);
  }
  return m;
}

export function NotificationsAdmin() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [tplRes, logRes] = await Promise.all([
      supabase.from("notification_templates").select("*").order("type").order("title"),
      supabase.from("notification_log").select("*").order("sent_at", { ascending: false }).limit(50),
    ]);
    setTemplates((tplRes.data as Template[]) || []);
    setLogs((logRes.data as LogRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const lastSent = useMemo(() => lastSentMap(logs), [logs]);
  const eventTpls = templates.filter((t) => t.type === "event_triggered");
  const recurringTpls = templates.filter((t) => t.type === "recurring");
  const oneTimeTpls = templates.filter((t) => t.type === "one_time");
  const pendingOne = oneTimeTpls.filter((t) => !t.sent_at);
  const sentOne = oneTimeTpls.filter((t) => !!t.sent_at);

  if (loading) return <p className="text-sm text-muted-foreground">Caricamento…</p>;

  return (
    <Tabs defaultValue="auto" className="space-y-4">
      <TabsList>
        <TabsTrigger value="auto">Automatiche</TabsTrigger>
        <TabsTrigger value="scheduled">Programmate</TabsTrigger>
        <TabsTrigger value="history">Storico</TabsTrigger>
      </TabsList>

      <TabsContent value="auto" className="space-y-6">
        <section className="space-y-3">
          <h3 className="font-semibold">Notifiche evento</h3>
          {eventTpls.map((t) => (
            <TemplateRow key={t.id} tpl={t} lastSent={lastSent.get(t.id)} onChange={load} />
          ))}
        </section>
        <section className="space-y-3">
          <h3 className="font-semibold">Notifiche ricorrenti</h3>
          {recurringTpls.map((t) => (
            <TemplateRow key={t.id} tpl={t} lastSent={lastSent.get(t.id)} onChange={load} />
          ))}
        </section>
      </TabsContent>

      <TabsContent value="scheduled" className="space-y-4">
        <NewOneTimeForm onCreated={load} />
        <Card className="p-4">
          <h3 className="font-semibold mb-3">In attesa</h3>
          {pendingOne.length === 0 && <p className="text-sm text-muted-foreground">Nessuna notifica programmata</p>}
          <ul className="divide-y">
            {pendingOne.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <p className="text-xs text-muted-foreground">{t.push_title} — {t.push_body}</p>
                  <p className="text-xs">📅 {t.scheduled_at ? new Date(t.scheduled_at).toLocaleString("it-IT") : "—"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={async () => {
                  if (!confirm("Annullare?")) return;
                  await supabase.from("notification_templates").delete().eq("id", t.id);
                  toast.success("Annullata"); load();
                }}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Inviate</h3>
          {sentOne.length === 0 && <p className="text-sm text-muted-foreground">Nessuna inviata</p>}
          <ul className="divide-y">
            {sentOne.map((t) => {
              const log = logs.find((l) => l.template_id === t.id);
              return (
                <li key={t.id} className="py-2">
                  <div className="font-medium">{t.title}</div>
                  <p className="text-xs text-muted-foreground">{t.push_title} — {t.push_body}</p>
                  <p className="text-xs">Inviata: {new Date(t.sent_at!).toLocaleString("it-IT")}{log ? ` · ${log.success_count}/${log.recipient_count} consegnate` : ""}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      </TabsContent>

      <TabsContent value="history">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Ultimi 50 invii</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-2">Quando</th>
                  <th className="py-2 pr-2">Template</th>
                  <th className="py-2 pr-2">Audience</th>
                  <th className="py-2 pr-2">Dest.</th>
                  <th className="py-2 pr-2">OK</th>
                  <th className="py-2 pr-2">KO</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const tpl = templates.find((t) => t.id === l.template_id);
                  return (
                    <tr key={l.id} className="border-b">
                      <td className="py-2 pr-2 whitespace-nowrap">{new Date(l.sent_at).toLocaleString("it-IT")}</td>
                      <td className="py-2 pr-2">{tpl?.title || (l.payload?.title ?? "—")}</td>
                      <td className="py-2 pr-2">{audiences.find((a) => a.value === l.audience)?.label || l.audience}</td>
                      <td className="py-2 pr-2">{l.recipient_count}</td>
                      <td className="py-2 pr-2 text-emerald-600">{l.success_count}</td>
                      <td className="py-2 pr-2 text-destructive">{l.failure_count}</td>
                    </tr>
                  );
                })}
                {logs.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nessun invio</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function TemplateRow({ tpl, lastSent, onChange }: { tpl: Template; lastSent?: string; onChange: () => void }) {
  const [draft, setDraft] = useState(tpl);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(tpl); }, [tpl.id]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(tpl);

  const toggle = async (active: boolean) => {
    await supabase.from("notification_templates").update({ is_active: active }).eq("id", tpl.id);
    onChange();
  };
  const save = async () => {
    if (draft.push_body.length > 120) return toast.error("Body max 120 caratteri");
    setBusy(true);
    let cron_expression = draft.cron_expression;
    if (draft.type === "recurring" && draft.send_hour != null && draft.send_minute != null) {
      const dow = (cron_expression || "* * * * *").split(/\s+/)[4] || "*";
      cron_expression = `${draft.send_minute} ${draft.send_hour} * * ${dow}`;
    }
    const { error } = await supabase.from("notification_templates").update({
      push_title: draft.push_title,
      push_body: draft.push_body,
      push_url: draft.push_url,
      audience: draft.audience,
      send_hour: draft.send_hour,
      send_minute: draft.send_minute,
      cron_expression,
    }).eq("id", tpl.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Salvato"); onChange();
  };
  const sendNow = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-push", { body: { templateId: tpl.id } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Inviata: ${data?.sent ?? 0} consegnate`); onChange();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-medium flex items-center gap-2">{tpl.title}
            {tpl.event_trigger && <Badge variant="secondary">{eventLabels[tpl.event_trigger] || tpl.event_trigger}</Badge>}
            {tpl.type === "recurring" && tpl.cron_expression && <Badge variant="outline">{tpl.cron_expression}</Badge>}
          </div>
          {lastSent && <p className="text-xs text-muted-foreground">Ultimo invio: {new Date(lastSent).toLocaleString("it-IT")}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Attiva</Label>
          <Switch checked={tpl.is_active} onCheckedChange={toggle} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Titolo push</Label><Input value={draft.push_title} onChange={(e) => setDraft({ ...draft, push_title: e.target.value })} /></div>
        <div><Label>URL</Label><Input value={draft.push_url || ""} onChange={(e) => setDraft({ ...draft, push_url: e.target.value })} placeholder="/team" /></div>
        <div className="md:col-span-2">
          <Label>Testo ({draft.push_body.length}/120)</Label>
          <Textarea value={draft.push_body} onChange={(e) => setDraft({ ...draft, push_body: e.target.value })} maxLength={120} />
        </div>
        <div><Label>Audience</Label>
          <Select value={draft.audience} onValueChange={(v) => setDraft({ ...draft, audience: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{audiences.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {tpl.type === "recurring" && (
          <div>
            <Label>Orario invio (UTC)</Label>
            <Input type="time" value={`${String(draft.send_hour ?? 0).padStart(2, "0")}:${String(draft.send_minute ?? 0).padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setDraft({ ...draft, send_hour: h, send_minute: m });
              }} />
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={save} disabled={!dirty || busy}><Save className="h-4 w-4 mr-1" /> Salva</Button>
        <Button size="sm" variant="outline" onClick={sendNow} disabled={busy}><Send className="h-4 w-4 mr-1" /> Invia ora</Button>
      </div>
    </Card>
  );
}

function NewOneTimeForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [push_title, setPushTitle] = useState("");
  const [push_body, setPushBody] = useState("");
  const [push_url, setPushUrl] = useState("");
  const [audience, setAudience] = useState("all");
  const [scheduled, setScheduled] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim() || !push_title.trim() || !push_body.trim() || !scheduled) return toast.error("Compila tutti i campi");
    if (push_body.length > 120) return toast.error("Testo max 120 caratteri");
    setBusy(true);
    const { error } = await supabase.from("notification_templates").insert({
      title: title.trim(),
      push_title: push_title.trim(),
      push_body: push_body.trim(),
      push_url: push_url.trim() || null,
      audience,
      type: "one_time",
      is_active: true,
      scheduled_at: new Date(scheduled).toISOString(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Programmata");
    setTitle(""); setPushTitle(""); setPushBody(""); setPushUrl(""); setScheduled("");
    onCreated();
  };

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Nuova notifica programmata</h3>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Titolo (interno)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Titolo push</Label><Input value={push_title} onChange={(e) => setPushTitle(e.target.value)} /></div>
        <div className="md:col-span-2"><Label>Testo ({push_body.length}/120)</Label>
          <Textarea value={push_body} onChange={(e) => setPushBody(e.target.value)} maxLength={120} /></div>
        <div><Label>URL (opzionale)</Label><Input value={push_url} onChange={(e) => setPushUrl(e.target.value)} placeholder="/team" /></div>
        <div><Label>Audience</Label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{audiences.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Quando</Label><Input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} /></div>
      </div>
      <Button onClick={create} disabled={busy}>Programma</Button>
    </Card>
  );
}
