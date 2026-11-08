"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTodo, type ActionState } from "@/app/actions/todos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionState = {};

export function AddTodoForm() {
  const [state, formAction, pending] = useActionState(addTodo, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // 添加成功后清空输入框
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          name="title"
          placeholder="要做什么？"
          aria-label="待办内容"
          maxLength={200}
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "添加中…" : "添加"}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
