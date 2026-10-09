"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth";

export function SignOutButton({ className, variant = "ghost", size, children }: Pick<ButtonProps, "className" | "variant" | "size" | "children">) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      loading={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {!pending ? <LogOut aria-hidden /> : null}
      {children ?? "Cerrar sesión"}
    </Button>
  );
}
