"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { OPERATOR_ROLES } from "@/lib/validations/clue";
import { Badge } from "@/components/ui/badge";

export type RoleType = (typeof OPERATOR_ROLES)[number];

interface RoleContextType {
  currentRole: RoleType;
  setRole: (role: RoleType) => void;
}

const RoleContext = createContext<RoleContextType>({
  currentRole: "综合管理人员",
  setRole: () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState<RoleType>("综合管理人员");

  useEffect(() => {
    const saved = localStorage.getItem("clue_lens_role") as RoleType | null;
    if (saved && OPERATOR_ROLES.includes(saved)) {
      setCurrentRole(saved);
    }
  }, []);

  const handleSetRole = (role: RoleType) => {
    setCurrentRole(role);
    localStorage.setItem("clue_lens_role", role);
  };

  return (
    <RoleContext.Provider value={{ currentRole, setRole: handleSetRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useCurrentRole() {
  return useContext(RoleContext);
}

export function RoleSwitcher() {
  const { currentRole, setRole } = useCurrentRole();

  return (
    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
      <span className="text-slate-500 font-medium hidden sm:inline">演示角色:</span>
      <select
        value={currentRole}
        onChange={(e) => setRole(e.target.value as RoleType)}
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
      >
        {OPERATOR_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
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
