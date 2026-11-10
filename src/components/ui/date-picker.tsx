"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  value?: string; // 字符串格式 YYYY-MM-DD
  onChange?: (dateStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  sizeVariant?: "default" | "sm";
  clearable?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "请选择日期",
  disabled = false,
  required = false,
  id,
  name,
  className,
  sizeVariant = "default",
  clearable = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // 解析传入的 YYYY-MM-DD 字符串为 Date
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, "yyyy-MM-dd");
      onChange?.(formatted);
      setOpen(false);
    } else {
      onChange?.("");
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* 隐藏表单域支持传统 FormData / Server Action 提交 */}
      {name && <input type="hidden" name={name} value={value || ""} required={required} />}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-normal text-slate-800 dark:text-slate-100 shadow-2xs outline-none transition-[color,box-shadow]",
              "hover:bg-slate-50 dark:hover:bg-slate-800/60",
              "focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
              sizeVariant === "sm" ? "h-8" : "h-9",
              !value && "text-slate-400 dark:text-slate-500"
            )}
          >
            <span className="truncate">
              {selectedDate ? format(selectedDate, "yyyy-MM-dd") : placeholder}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {clearable && value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              <CalendarIcon className="h-3.5 w-3.5 text-slate-400 opacity-80" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-xl shadow-xl border-slate-200 dark:border-slate-800" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            autoFocus
            locale={zhCN}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
