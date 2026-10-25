"use client";

import { useState } from "react";
import { parseDate, today, type CalendarDate } from "@internationalized/date";
import { Button, Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader, CalendarHeaderCell, Dialog, DialogTrigger, Heading, I18nProvider, ListBox, ListBoxItem, Popover } from "react-aria-components";
import styles from "./date-time-pickers.module.css";

type FieldProps = { id: string; label: string; value: string; onChange(value: string): void; invalid?: boolean; describedBy?: string };
const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function calendarDate(value?: string): CalendarDate | null {
  try { return value ? parseDate(value) : null; } catch { return null; }
}
function dateText(value: string) {
  const date = calendarDate(value);
  return date ? `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}` : value;
}
function typedDate(value: string) {
  const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return calendarDate(parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : value)?.toString() ?? "";
}
function timeValue(value: string) {
  const parts = value.match(/^(\d{1,2}):(\d{2})$/);
  return parts && Number(parts[1]) < 24 && Number(parts[2]) < 60 ? `${parts[1]!.padStart(2, "0")}:${parts[2]}` : "";
}
function PickerIcon({ kind }: { kind: "date" | "time" }) {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {kind === "date" ? <><rect x="3.5" y="5.5" width="17" height="15" rx="3" /><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 17.5h.01M12 17.5h.01" /></> : <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>}
  </svg>;
}
function Chevron({ next = false }: { next?: boolean }) {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={next ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} /></svg>;
}

export function DatePickerInput({ id, label, value, onChange, invalid, describedBy, minDate, maxDate }: FieldProps & { minDate?: string; maxDate?: string }) {
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<string | null>(null);
  const selected = calendarDate(value), minimum = calendarDate(minDate), maximum = calendarDate(maxDate), currentDay = today("Europe/London");
  const todayAllowed = (!minimum || currentDay.compare(minimum) >= 0) && (!maximum || currentDay.compare(maximum) <= 0);
  const focused = selected ?? (minimum && currentDay.compare(minimum) < 0 ? minimum : maximum && currentDay.compare(maximum) > 0 ? maximum : currentDay);
  const choose = (date: string) => { onChange(date); setEditing(null); setOpen(false); };
  return <I18nProvider locale="en-GB"><div className={styles.control} data-open={open || undefined} data-invalid={invalid || undefined}>
    <input id={id} className={styles.input} data-picker-field type="text" role="combobox" aria-autocomplete="none" placeholder="DD/MM/YYYY" autoComplete="off" spellCheck={false} value={editing ?? dateText(value)} aria-invalid={invalid || undefined} aria-describedby={describedBy} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-dialog` : undefined} onFocus={() => setEditing(dateText(value))} onBlur={() => setEditing(null)} onChange={(event) => { setEditing(event.target.value); onChange(typedDate(event.target.value)); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }} />
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button type="button" className={styles.trigger} aria-label={`Choose ${label}`}><PickerIcon kind="date" /></Button>
      <Popover placement="bottom end" offset={10} containerPadding={12} className={styles.popover}>
        <Dialog id={`${id}-dialog`} aria-label={`Choose ${label}`} className={styles.dialog}>
          <Calendar aria-label={`${label} calendar`} value={selected} minValue={minimum ?? undefined} maxValue={maximum ?? undefined} defaultFocusedValue={focused} firstDayOfWeek="mon" autoFocus onChange={(date) => choose(date.toString())} className={styles.calendar}>
            <header className={styles.calendarHeader}><Heading className={styles.month} /><div className={styles.monthActions}><Button type="button" slot="previous" aria-label="Previous month" className={styles.monthButton}><Chevron /></Button><Button type="button" slot="next" aria-label="Next month" className={styles.monthButton}><Chevron next /></Button></div></header>
            <CalendarGrid weekdayStyle="short" className={styles.calendarGrid}>
              <CalendarGridHeader>{(day) => <CalendarHeaderCell className={styles.weekday}>{day}</CalendarHeaderCell>}</CalendarGridHeader>
              <CalendarGridBody>{(date) => <CalendarCell date={date} className={styles.day} />}</CalendarGridBody>
            </CalendarGrid>
          </Calendar>
          <footer className={styles.footer}><Button type="button" className={styles.quietButton} onPress={() => choose("")}>Clear</Button><Button type="button" className={styles.todayButton} isDisabled={!todayAllowed} onPress={() => choose(currentDay.toString())}>Today</Button></footer>
        </Dialog>
      </Popover>
    </DialogTrigger>
  </div></I18nProvider>;
}

export function TimePickerInput({ id, label, value, onChange, invalid, describedBy }: FieldProps) {
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<string | null>(null);
  const [hour, setHour] = useState(""), [minute, setMinute] = useState("");
  function changeOpen(next: boolean) {
    if (next) { const existing = timeValue(value); setHour(existing.slice(0, 2)); setMinute(existing.slice(3, 5)); }
    setOpen(next);
  }
  function choose(next: string) { onChange(next); setEditing(null); setOpen(false); }
  return <div className={styles.control} data-open={open || undefined} data-invalid={invalid || undefined}>
    <input id={id} className={styles.input} data-picker-field type="text" role="combobox" aria-autocomplete="none" placeholder="HH:mm" autoComplete="off" spellCheck={false} maxLength={5} value={editing ?? value} aria-invalid={invalid || undefined} aria-describedby={describedBy} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-dialog` : undefined} onFocus={() => setEditing(value)} onBlur={() => setEditing(null)} onChange={(event) => { setEditing(event.target.value); onChange(timeValue(event.target.value)); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); changeOpen(true); } }} />
    <DialogTrigger isOpen={open} onOpenChange={changeOpen}>
      <Button type="button" className={styles.trigger} aria-label={`Choose ${label}`}><PickerIcon kind="time" /></Button>
      <Popover placement="bottom end" offset={10} containerPadding={12} className={`${styles.popover} ${styles.timePopover}`}>
        <Dialog id={`${id}-dialog`} aria-label={`Choose ${label}`} className={styles.dialog}>
          <header className={styles.timeHeader}><div><p className={styles.timeCaption}>Choose a time</p><p className={styles.timePreview} aria-live="polite">{hour || "––"}<span>:</span>{minute || "––"}</p></div><span className={styles.clockFormat}>24-hour</span></header>
          <div className={styles.timeColumns}>
            <div><p className={styles.columnLabel} id={`${id}-hours`}>Hour</p><ListBox aria-labelledby={`${id}-hours`} autoFocus selectionMode="single" escapeKeyBehavior="none" selectedKeys={hour ? [hour] : []} onSelectionChange={(keys) => { if (keys !== "all") setHour(String([...keys][0] ?? "")); }} className={styles.timeList}>{hours.map((item) => <ListBoxItem key={item} id={item} textValue={item} className={styles.timeOption}>{item}</ListBoxItem>)}</ListBox></div>
            <div><p className={styles.columnLabel} id={`${id}-minutes`}>Minute</p><ListBox aria-labelledby={`${id}-minutes`} selectionMode="single" escapeKeyBehavior="none" selectedKeys={minute ? [minute] : []} onSelectionChange={(keys) => { if (keys !== "all") setMinute(String([...keys][0] ?? "")); }} className={styles.timeList}>{minutes.map((item) => <ListBoxItem key={item} id={item} textValue={item} className={styles.timeOption}>{item}</ListBoxItem>)}</ListBox></div>
          </div>
          <footer className={styles.footer}><Button type="button" className={styles.quietButton} onPress={() => choose("")}>Clear</Button><Button type="button" className={styles.applyButton} isDisabled={!hour || !minute} onPress={() => choose(`${hour}:${minute}`)}>Set time</Button></footer>
        </Dialog>
      </Popover>
    </DialogTrigger>
  </div>;
}
