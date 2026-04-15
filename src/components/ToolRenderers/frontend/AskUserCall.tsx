"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { JsonValue } from "@/lib/chat/contracts";
import { isJsonObject } from "@/lib/chat/contracts";
import type { Field } from "../types";
import { ToolCallCard } from "../ToolCallCard";

const AskUserIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ── helpers ──────────────────────────────────────────────

function normalizeFields(raw: JsonValue | undefined): Field[] {
  if (!Array.isArray(raw)) return [];
  const fields: Field[] = [];
  for (const entry of raw) {
    if (!isJsonObject(entry)) continue;
    const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : "";
    if (!name) continue;
    const required = typeof entry.required === "boolean" ? entry.required : undefined;

    if (entry.type === "select" && Array.isArray(entry.options)) {
      fields.push({
        name,
        type: "select",
        options: entry.options.filter((x): x is string => typeof x === "string"),
        required,
      });
    } else {
      fields.push({
        name,
        type: "text",
        placeholder: typeof entry.placeholder === "string" ? entry.placeholder : undefined,
        required,
      });
    }
  }
  return fields;
}

// ── CustomSelect ────────────────────────────────────────

function CustomSelect({
  value, options, placeholder, onChange, hasError,
}: {
  value: string; options: string[]; placeholder: string;
  onChange: (next: string) => void; hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (wrapperRef.current && !wrapperRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  const buttonClass = `w-full px-3 py-2 text-sm rounded-lg transition-all duration-200 text-left flex items-center justify-between gap-2 ${
    hasError
      ? "bg-red-50 border border-red-200 focus:ring-2 focus:ring-red-100"
      : "bg-white/75 border border-indigo-100 focus:ring-2 focus:ring-indigo-100"
  } focus:outline-none focus:bg-white ${hasError ? "focus:border-red-300" : "focus:border-indigo-300"}`;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        className={buttonClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); }
        }}
      >
        <span className={value ? "text-slate-800" : "text-slate-400"}>{value || placeholder}</span>
        <span className="text-slate-400">
          <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div role="listbox" className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-indigo-100 bg-white/95 shadow-[0_12px_24px_-20px_rgba(79,70,229,0.4)]">
          <div className="max-h-56 overflow-auto py-1">
            {options.map((opt) => {
              const selected = opt === value;
              return (
                <button
                  key={opt} type="button" role="option" aria-selected={selected}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50/60 ${selected ? "bg-indigo-50/80 text-indigo-700" : "text-slate-700"}`}
                  onClick={() => { onChange(opt); setOpen(false); }}
                >
                  <span className="truncate">{opt}</span>
                  {selected && (
                    <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Submitted view ──────────────────────────────────────

function SubmittedView() {
  return (
    <div className="mr-auto w-full max-w-[760px] rounded-2xl border border-emerald-200/80 bg-white/85 p-3.5 shadow-[0_4px_12px_-6px_rgba(16,185,129,0.25)] backdrop-blur-[1px]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-emerald-700">信息已提交</p>
          <p className="text-[11px] text-emerald-600/70">正在根据你的输入继续处理</p>
        </div>
      </div>
    </div>
  );
}

// ── Form view ───────────────────────────────────────────

function FormView({ title, fields, onSubmit }: { title: string; fields: Field[]; onSubmit: (data: Record<string, string>) => void }) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (name: string, value: string) => {
    setFieldErrors((prev) => { if (!prev[name]) return prev; const next = { ...prev }; delete next[name]; return next; });
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const uiFields = useMemo(() => {
    const normalizedFields: Field[] = Array.isArray(fields) ? fields : typeof fields === "object" && fields !== null ? [fields] : [];
    return normalizedFields.map((field, index) => ({
      ...field,
      _fieldName: field.name || `field_${index}`,
      _fieldLabel: field.name || `字段 ${index + 1}`,
      _fieldType: field.type || "text",
    }));
  }, [fields]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const f of uiFields) {
      if (!f.required) continue;
      const value = (formData[f._fieldName] || "").trim();
      if (!value) nextErrors[f._fieldName] = "此项为必填";
    }
    if (Object.keys(nextErrors).length > 0) { setFieldErrors(nextErrors); return; }
    setIsSubmitting(true);
    onSubmit(formData);
  };

  const requiredCount = uiFields.filter((f) => f.required).length;
  const inputBaseClass = "w-full rounded-lg border border-indigo-100 bg-white/75 px-3 py-2 text-sm transition-all duration-200 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mr-auto w-full max-w-[760px] rounded-2xl border border-indigo-100/80 bg-white/85 p-4 shadow-[0_10px_24px_-20px_rgba(79,70,229,0.45)] backdrop-blur-[1px]">
      <div className="mb-4 flex items-center gap-2.5 border-b border-indigo-100/50 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-[11px] text-slate-400">{uiFields.length} 个字段{requiredCount > 0 ? ` · ${requiredCount} 项必填` : ""}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {uiFields.map((field) => {
          const fieldName = field._fieldName;
          const fieldLabel = field._fieldLabel;
          const fieldType = field._fieldType;
          const isFocused = focusedField === fieldName;
          const hasValue = !!formData[fieldName];
          const error = fieldErrors[fieldName];

          return (
            <div key={fieldName} className={`space-y-1 p-2 rounded-lg transition-all duration-200 ${isFocused ? "bg-indigo-50/55" : hasValue ? "bg-white/55" : ""}`}>
              <label className={`text-xs font-medium flex items-center gap-1.5 ${error ? "text-red-700" : "text-slate-700"}`}>
                {fieldLabel}
                {field.required && <span className="text-red-500">*</span>}
              </label>

              {fieldType === "select" && "options" in field && field.options ? (
                <CustomSelect
                  value={formData[fieldName] || ""}
                  options={field.options}
                  placeholder="请选择..."
                  hasError={Boolean(error)}
                  onChange={(next) => handleChange(fieldName, next)}
                />
              ) : (
                <textarea
                  className={`${inputBaseClass} resize-none ${error ? "border-red-200 bg-red-50 focus:ring-red-100 focus:border-red-300" : ""}`}
                  rows={3}
                  placeholder={"placeholder" in field && field.placeholder ? field.placeholder : "请输入..."}
                  value={formData[fieldName] || ""}
                  onChange={(e) => handleChange(fieldName, e.target.value)}
                  onFocus={() => setFocusedField(fieldName)}
                  onBlur={() => setFocusedField(null)}
                />
              )}

              {error && <p className="text-[11px] text-red-600">{error}</p>}
            </div>
          );
        })}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-[0_4px_12px_-4px_rgba(79,70,229,0.5)] transition-all duration-200 hover:from-indigo-500 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                提交中...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                确认提交
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main component ──────────────────────────────────────

interface AskUserArgs {
  title?: string;
  fields?: JsonValue;
}

interface AskUserResult {
  status?: string;
}

export function AskUserCall({
  args,
  result,
  pending,
  animate,
  onSubmit,
}: {
  args: AskUserArgs;
  result?: AskUserResult;
  pending?: boolean;
  animate?: boolean;
  onSubmit: (data: Record<string, string>) => void;
}) {
  const title = typeof args.title === "string" && args.title.trim() ? args.title : "需要你的输入";

  // submitted
  if (result?.status === "success") {
    return <SubmittedView />;
  }

  // streaming — args still arriving
  if (pending) {
    return <ToolCallCard title={title} icon={AskUserIcon} status="loading" animate={animate} />;
  }

  // form — TOOL_CALL_START has arrived, args are complete
  const fields = normalizeFields(args.fields);
  return <FormView title={title} fields={fields} onSubmit={onSubmit} />;
}
