"use client";

import React, { createContext, useContext, useState, useTransition } from "react";
import { OPERATOR_ROLES } from "@/lib/validations/clue";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { switchDemoRoleAction } from "@/app/actions/clues";
import { useRouter } from "next/navigation";

export type RoleType = (typeof OPERATOR_ROLES)[number];

interface RoleContextType {
  currentRole: RoleType;
  setRole: (role: RoleType) => void;
  isPending: boolean;
}

const RoleContext = createContext<RoleContextType>({
  currentRole: "综合管理人员",
  setRole: () => {},
  isPending: false,
});

export function RoleProvider({
  children,
  initialRole = "综合管理人员",
}: {
  children: React.ReactNode;
  initialRole?: RoleType;
}) {
  const [currentRole, setCurrentRole] = useState<RoleType>(initialRole);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSetRole = (role: RoleType) => {
    setCurrentRole(role);
    startTransition(async () => {
      await switchDemoRoleAction({ role });
      router.refresh();
    });
  };

  return (
    <RoleContext.Provider
      value={{ currentRole, setRole: handleSetRole, isPending }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useCurrentRole() {
  return useContext(RoleContext);
}

export function RoleSwitcher() {
  const { currentRole, setRole, isPending } = useCurrentRole();

  return (
    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
      <span className="text-slate-500 font-medium hidden sm:inline">
        {isPending ? "切换中..." : "当前角色:"}
      </span>
      <Select
        value={currentRole}
        disabled={isPending}
        onValueChange={(val) => setRole(val as RoleType)}
      >
        <SelectTrigger size="sm" className="h-7 w-[130px] font-semibold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATOR_ROLES.map((role) => (
            <SelectItem key={role} value={role} className="text-xs">
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant="outline" className="text-[10px] hidden md:inline">
        {currentRole === "综合管理人员" && "负责分派/导入"}
        {currentRole === "线索核查人员" && "负责办理填报"}
        {currentRole === "部门负责人" && "负责复核审批/归档"}
        {currentRole === "情报分析人员" && "负责异常研判/建议"}
        {currentRole === "专卖监督管理人员" && "负责全流程督察"}
      </Badge>
    </div>
  );
}
