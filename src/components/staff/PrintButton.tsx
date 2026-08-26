"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.print()} size="sm">
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
