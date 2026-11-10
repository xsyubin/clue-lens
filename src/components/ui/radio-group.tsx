"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  variantColor = "default",
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  variantColor?: "emerald" | "red" | "default";
}) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600 shadow-2xs outline-none transition-colors cursor-pointer",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantColor === "emerald" &&
          "data-[state=checked]:border-emerald-600 data-[state=checked]:text-emerald-600 focus-visible:ring-emerald-500/20",
        variantColor === "red" &&
          "data-[state=checked]:border-red-600 data-[state=checked]:text-red-600 focus-visible:ring-red-500/20",
        variantColor === "default" &&
          "data-[state=checked]:border-primary data-[state=checked]:text-primary",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <Circle className="h-2 w-2 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
