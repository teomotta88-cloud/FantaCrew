import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { weekOf } from "@/lib/week";
import { SEASON } from "@/lib/constants";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/contexts/AuthContext";
import { useDraftState } from "@/hooks/useDraftState";
import { useSeason } from "@/contexts/SeasonContext";
import { ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
import { SchedulesAdmin } from "@/components/admin/SchedulesAdmin";

type Training = {
  id: string;
  training_date: string;
  start_time: string | null;
  location: string | null;
  category: string;
};

type CalendarMatchRow = {
  id: string;
  match_date: string;
  opponent: string;
  status: string;
  home_away?: "home" | "away";
};

type CalendarGridProps = {
  month: Date;
  trainings: Training[];
  scheduledDates: string[];
  matches: CalendarMatchRow[];
  selectedDate: string | null;
  onDayClick: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

const MONTH_NAMES = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];
const DOW_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function CalendarGrid({
  month,
  trainings,
  scheduledDates,
  matches,
  selectedDate,
  onDayClick,
  onPrevMonth,
  onNextMonth,
}: CalendarGridProps) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const todayStr = fmtLocal(new Date());
  const trainingByDate = new Map(trainings.map((t) => [t.training_date, t]));
  const matchByDate = new Map(matches.map((mx) => [mx.match_date, mx]));
  const scheduledSet = new Set(scheduledDates);

  // First day of month, then back to Monday
  const first = new Date(year, m, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0=Mon
  const gridStart = new Date(year, m, 1 - startOffset);

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === m });
  }

  return (
    <Card className="p-3 md:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold text-sm md:text-base">
          {MONTH_NAMES[m]} {year}
        </div>
        <Button variant="outline" size="sm" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] md:text-xs font-medium text-muted-foreground">
        {DOW_LABELS.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }, i) => {
          const ds = fmtLocal(date);
          const t = trainingByDate.get(ds);
          const scheduled = scheduledSet.has(ds);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(ds)}
              className={[
                "relative rounded-md border text-left p-1 transition",
                "h-10 md:h-16 text-[11px] md:text-xs",
                inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                isToday ? "ring-2 ring-primary" : "",
                isSelected ? "ring-2 ring-primary/60" : "",
                "hover:bg-muted/40",
              ].join(" ")}
            >
              <div className="font-medium">{date.getDate()}</div>
              {(t || scheduled || matchByDate.get(ds)) && (
                <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5">
                  {(t || scheduled) && (
                    <div className="flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${t ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                      />
                      <span className="hidden md:inline text-[10px] text-emerald-700 dark:text-emerald-400 truncate font-medium">
                        {t ? "Allenamento" : ""}
                      </span>
                    </div>
                  )}
                  {matchByDate.get(ds) && (
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full shrink-0 bg-blue-500" />
                      <span className="hidden md:inline text-[10px] text-blue-600 dark:text-blue-400 truncate font-medium">
                        Match
                      </span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateTrainingDates(days: number[]): string[] {
  if (!days?.length) return [];
  const today = new Date();
  const year = today.getFullYear();
  // Calendar year: Jan 1 – Dec 31 of current year
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (days.includes(d.getDay())) {
      out.push(toLocalDateString(d));
    }
  }
  return out;
}

export function TrainingsAdmin() {
  const { categories } = useCategories({ activeOnly: true });
  const { user } = useAuth();
  const { seasonId, activeSeason } = useSeason();
  const [category, setCategory] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [players, setPlayers] = useState<{ id: string; full_name: string }[]>([]);
  const trainingId = `${date}|${category}`;
  const [presentArr, setPresentArr, clearPresent] = useDraftState<string[]>(`draft_attendance_${trainingId}`, []);
  const present = useMemo(() => new Set(presentArr), [presentArr]);
  const [existing, setExisting] = useState<Map<string, "training_attendance" | "training_absence">>(new Map());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthTrainings, setMonthTrainings] = useState<Training[]>([]);
  const [monthMatches, setMonthMatches] = useState<CalendarMatchRow[]>([]);
  const [detailForm, setDetailForm] = useState<{ start_time: string; location: string; notes: string }>({
    start_time: "",
    location: "",
    notes: "",
  });
  const [savingDetail, setSavingDetail] = useState(false);

  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0].name);
  }, [categories, category]);

  const currentCat = categories.find((c) => c.name === category);
  const dates = useMemo(() => generateTrainingDates(currentCat?.training_days || []), [currentCat?.training_days]);

  // Load trainings for current calendar month + category
  const reloadMonth = async () => {
    if (!category) return;
    const y = calMonth.getFullYear();
    const mo = calMonth.getMonth();
    const first = fmtLocal(new Date(y, mo, 1));
    const last = fmtLocal(new Date(y, mo + 1, 0));
    const { data } = await supabase
      .from("trainings")
      .select("id,training_date,start_time,location,category")
      .eq("category", category)
      .gte("training_date", first)
      .lte("training_date", last);
    setMonthTrainings((data as Training[]) || []);
    // Load matches for this month
    const { data: mData } = await supabase
      .from("matches")
      .select("id,match_date,opponent,status,home_away")
      .eq("category", category)
      .gte("match_date", first)
      .lte("match_date", last);
    setMonthMatches((mData as CalendarMatchRow[]) || []);
  };

  useEffect(() => {
    reloadMonth();
  }, [calMonth, category]);

  // Sync detail form when selection changes
  useEffect(() => {
    if (!selectedDate) return;
    const t = monthTrainings.find((x) => x.training_date === selectedDate);
    setDetailForm({
      start_time: t?.start_time?.slice(0, 5) ?? "",
      location: t?.location ?? "",
      notes: "",
    });
  }, [selectedDate, monthTrainings]);

  useEffect(() => {
    if (!category) return;
    supabase
      .from("players")
      .select("id,full_name")
      .eq("category", category)
      .order("full_name")
      .then(({ data }) => setPlayers(data || []));
    setExisting(new Map());
  }, [category]);

  // Pre-load existing presences for this date
  useEffect(() => {
    if (!date || !category) return;
    (async () => {
      const trainingId = `${date}|${category}`;
      const { data } = await supabase
        .from("weekly_events")
        .select("player_id,rule_key")
        .eq("training_id", trainingId)
        .in("rule_key", ["training_attendance", "training_absence"]);
      const map = new Map<string, "training_attendance" | "training_absence">();
      (data || []).forEach((r: any) => map.set(r.player_id, r.rule_key));
      setExisting(map);

      const draft = localStorage.getItem(`draft_attendance_${trainingId}`);
      if (!draft) {
        setPresentArr(
          (data || []).filter((r: any) => r.rule_key === "training_attendance").map((r: any) => r.player_id),
        );
        setDirty(false);
      } else {
        setDirty(true);
      }
    })();
  }, [date, category]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        window.dispatchEvent(new Event("storage"));
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const toggle = (id: string) => {
    const next = new Set(present);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPresentArr([...next]);
    setDirty(true);
  };

  const allOn = () => {
    setPresentArr(players.map((p) => p.id));
    setDirty(true);
  };
  const allOff = () => {
    setPresentArr([]);
    setDirty(true);
  };

  const save = async () => {
    if (!date) return toast.error("Seleziona una data");
    setSaving(true);
    const week = weekOf(date, activeSeason?.starts_at);
    const trainingId = `${date}|${category}`;
    const noteTag = `training:${date}`;
    const nowIso = new Date().toISOString();

    // Compute only players whose status has changed
    const changed = players.filter((p) => {
      const prev = existing.get(p.id); // "training_attendance" | "training_absence" | undefined
      const next = present.has(p.id) ? "training_attendance" : "training_absence";
      return prev !== next;
    });

    if (changed.length === 0) {
      setSaving(false);
      toast.info("Nessuna variazione da salvare");
      clearPresent();
      setDirty(false);
      return;
    }

    // For changed players: delete old row (if any) then insert new
    const changedIds = changed.map((p) => p.id);
    await supabase
      .from("weekly_events")
      .delete()
      .in("rule_key", ["training_attendance", "training_absence"])
      .eq("training_id", trainingId)
      .in("player_id", changedIds);

    const rows = changed.map((p) => ({
      player_id: p.id,
      rule_key: present.has(p.id) ? "training_attendance" : "training_absence",
      week,
      quantity: 1,
      notes: `${noteTag}|${category}`,
      training_id: trainingId,
      season: SEASON,
      inserted_by: user?.id ?? null,
      inserted_at: nowIso,
    }));
    const { error } = await supabase.from("weekly_events").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    const added = changed.filter((p) => present.has(p.id)).length;
    const removed = changed.filter((p) => !present.has(p.id)).length;
    const parts = [];
    if (added) parts.push(`+${added} presenti`);
    if (removed) parts.push(`-${removed} assenti`);
    toast.success(`Aggiornate: ${parts.join(", ")} (${changed.length} variazioni)`);
    clearPresent();
    // Refresh state from DB
    const { data: refreshed } = await supabase
      .from("weekly_events")
      .select("player_id,rule_key")
      .eq("training_id", trainingId)
      .in("rule_key", ["training_attendance", "training_absence"]);
    const map = new Map<string, "training_attendance" | "training_absence">();
    (refreshed || []).forEach((r: any) => map.set(r.player_id, r.rule_key));
    setExisting(map);
    setPresentArr(
      (refreshed || []).filter((r: any) => r.rule_key === "training_attendance").map((r: any) => r.player_id),
    );
    setDirty(false);
  };

  const filtered = players.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  const selectedTraining = selectedDate ? monthTrainings.find((t) => t.training_date === selectedDate) : null;
  const isPastDate = !!selectedDate && selectedDate < fmtLocal(new Date());
  const [isEditingPast, setIsEditingPast] = useState(false);

  const createTraining = async () => {
    if (!selectedDate || !category) return;
    setSavingDetail(true);
    const { error } = await supabase.from("trainings").insert({
      category,
      training_date: selectedDate,
      start_time: detailForm.start_time || null,
      location: detailForm.location || null,
      season_id: seasonId,
    });
    setSavingDetail(false);
    if (error)
      return toast.error(
        error.message.includes("duplicate") ? "Allenamento già presente in questa data" : error.message,
      );
    toast.success("Allenamento aggiunto");
    reloadMonth();
  };

  const updateTraining = async () => {
    if (!selectedTraining) return;
    setSavingDetail(true);
    const { error } = await supabase
      .from("trainings")
      .update({
        start_time: detailForm.start_time || null,
        location: detailForm.location || null,
      })
      .eq("id", selectedTraining.id);
    setSavingDetail(false);
    if (error) return toast.error(error.message);
    toast.success("Modifiche salvate");
    reloadMonth();
  };

  const deleteTraining = async () => {
    if (!selectedTraining) return;
    if (!confirm("Eliminare questo allenamento?")) return;
    const { error } = await supabase.from("trainings").delete().eq("id", selectedTraining.id);
    if (error) return toast.error(error.message);
    toast.success("Allenamento eliminato");
    setMonthTrainings((arr) => arr.filter((t) => t.id !== selectedTraining.id));
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="calendario">
        <TabsList className="mb-4">
          <TabsTrigger value="calendario">📅 Calendario</TabsTrigger>
          <TabsTrigger value="regole">🗓️ Regole allenamenti</TabsTrigger>
        </TabsList>
        <TabsContent value="regole">
          <SchedulesAdmin />
        </TabsContent>
        <TabsContent value="calendario">
          <Card className="p-4">
            <Label>Categoria</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={category === c.name ? "default" : "outline"}
                  onClick={() => {
                    setCategory(c.name);
                    setSelectedDate(null);
                  }}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            {!dates.length && currentCat && (
              <p className="text-xs text-muted-foreground mt-2">
                Imposta i giorni di allenamento dalla sezione "Categorie".
              </p>
            )}
          </Card>

          <CalendarGrid
            month={calMonth}
            trainings={monthTrainings}
            scheduledDates={dates}
            matches={monthMatches}
            selectedDate={selectedDate}
            onDayClick={(d) => {
              setSelectedDate(d);
              setDate(d);
            }}
            onPrevMonth={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            onNextMonth={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          />

          {selectedDate && (
            <div
              className={[
                "md:static md:translate-y-0 md:shadow-none md:border-0 md:p-0",
                "fixed bottom-0 left-0 right-0 z-[70] bg-background border-t shadow-xl",
                "transition-transform duration-300 max-h-[85vh] overflow-y-auto",
                "translate-y-0",
              ].join(" ")}
            >
              <div className="md:hidden flex flex-col items-center pt-2">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="absolute right-3 top-2 p-1 text-muted-foreground"
                  aria-label="Chiudi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 pb-24 md:pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Allenamento del</div>
                    <div className="font-semibold">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString("it-IT", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:inline-flex"
                    onClick={() => setSelectedDate(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {/* Match detail */}
                {(() => {
                  const mx = monthMatches.find((m) => m.match_date === selectedDate);
                  if (!mx) return null;
                  const label = mx.home_away === "home" ? `Lambro vs ${mx.opponent}` : `${mx.opponent} vs Lambro`;
                  return (
                    <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-blue-800 dark:text-blue-300">⚽ Match</div>
                        <div className="text-sm truncate">{label}</div>
                      </div>
                      <Badge
                        variant={
                          mx.status === "won"
                            ? "default"
                            : mx.status === "lost"
                              ? "destructive"
                              : mx.status === "draw"
                                ? "secondary"
                                : "outline"
                        }
                        className="shrink-0"
                      >
                        {mx.status === "won"
                          ? "Vinta"
                          : mx.status === "lost"
                            ? "Persa"
                            : mx.status === "draw"
                              ? "Pareggio"
                              : "Programmata"}
                      </Badge>
                    </div>
                  );
                })()}

                <Card className="p-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Orario</Label>
                      <Input
                        type="time"
                        value={detailForm.start_time}
                        onChange={(e) => setDetailForm({ ...detailForm, start_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Luogo</Label>
                      <Input
                        value={detailForm.location}
                        onChange={(e) => setDetailForm({ ...detailForm, location: e.target.value })}
                        placeholder="es. Campo Lambro"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Note</Label>
                    <Textarea
                      value={detailForm.notes}
                      onChange={(e) => setDetailForm({ ...detailForm, notes: e.target.value })}
                      placeholder="Note opzionali"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTraining ? (
                      <>
                        <Button size="sm" onClick={updateTraining} disabled={savingDetail}>
                          Salva modifiche
                        </Button>
                        <Button size="sm" variant="destructive" onClick={deleteTraining}>
                          <Trash2 className="h-4 w-4 mr-1" /> Elimina
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={createTraining} disabled={savingDetail}>
                        Aggiungi allenamento
                      </Button>
                    )}
                  </div>
                </Card>

                {selectedTraining && (
                  <>
                    {isPastDate && !isEditingPast ? (
                      /* ── Read-only: past training ── */
                      <Card className="p-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">Presenze registrate</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {[...existing.values()].filter((v) => v === "training_attendance").length}/
                              {players.length}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const presentIds = [...existing.entries()]
                                  .filter(([_k, v]) => v === "training_attendance")
                                  .map(([k]) => k);
                                setPresentArr(presentIds);
                                setDirty(false);
                                setIsEditingPast(true);
                              }}
                            >
                              ✏️ Modifica
                            </Button>
                          </div>
                        </div>
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Cerca giocatore…"
                          className="max-w-xs mb-2"
                        />
                        <ul className="divide-y max-h-[50vh] overflow-auto border rounded-md">
                          {filtered.map((p) => {
                            const status = existing.get(p.id);
                            const present = status === "training_attendance";
                            const absent = status === "training_absence";
                            return (
                              <li key={p.id} className="flex items-center gap-3 p-3">
                                <div className="flex-1 min-w-0 font-medium truncate">{p.full_name}</div>
                                {present && <Badge className="bg-emerald-500 text-white">✓ Presente</Badge>}
                                {absent && (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    ✗ Assente
                                  </Badge>
                                )}
                                {!status && (
                                  <Badge variant="outline" className="text-muted-foreground opacity-50">
                                    —
                                  </Badge>
                                )}
                              </li>
                            );
                          })}
                          {filtered.length === 0 && (
                            <li className="p-6 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                          )}
                        </ul>
                      </Card>
                    ) : (
                      /* ── Editable: future/today training ── */
                      <>
                        <Card className="p-3 space-y-3">
                          <div className="flex flex-wrap gap-2 items-center">
                            <Input
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              placeholder="Cerca giocatore…"
                              className="max-w-xs"
                            />
                            <Button variant="outline" size="sm" onClick={allOn}>
                              Tutti presenti
                            </Button>
                            <Button variant="outline" size="sm" onClick={allOff}>
                              Tutti assenti
                            </Button>
                            <Badge variant="secondary">
                              {present.size}/{players.length}
                            </Badge>
                            {dirty && (
                              <span className="text-xs text-amber-500 font-medium">● Modifiche non salvate</span>
                            )}
                          </div>
                          <ul className="divide-y max-h-[45vh] overflow-auto border rounded-md">
                            {filtered.map((p) => {
                              const isOn = present.has(p.id);
                              const saved = existing.get(p.id);
                              const savedLabel =
                                saved === "training_attendance"
                                  ? "✓ presente"
                                  : saved === "training_absence"
                                    ? "✗ assente"
                                    : "non impostato";
                              return (
                                <li
                                  key={p.id}
                                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40"
                                  onClick={() => toggle(p.id)}
                                >
                                  <Checkbox checked={isOn} onCheckedChange={() => toggle(p.id)} />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{p.full_name}</div>
                                    <div className="text-[10px] text-muted-foreground">Stato salvato: {savedLabel}</div>
                                  </div>
                                  <Badge variant={isOn ? "default" : "outline"}>{isOn ? "Presente" : "Assente"}</Badge>
                                </li>
                              );
                            })}
                            {filtered.length === 0 && (
                              <li className="p-6 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                            )}
                          </ul>
                        </Card>
                        <div className="flex flex-col gap-2">
                          {isPastDate && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full md:w-auto md:self-end"
                              onClick={() => setIsEditingPast(false)}
                            >
                              Annulla modifica
                            </Button>
                          )}
                          <Button
                            size="lg"
                            onClick={save}
                            disabled={saving || !date}
                            className="w-full md:w-auto md:self-end"
                          >
                            {saving ? "Salvataggio…" : "Salva presenze"}
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
