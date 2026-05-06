"use client";

import { useState } from "react";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { isEvmAddress } from "@/lib/address";

export function AddressInput({
  onSubmit,
  loading,
  disabled,
}: {
  onSubmit: (addr: string) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const valid = !!trimmed && isEvmAddress(trimmed);
  const showError = touched && !valid && trimmed.length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="relative flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="wallet-search-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="0x… EVM wallet address"
            spellCheck={false}
            autoComplete="off"
            className="mono h-11 rounded-full pl-10 pr-4 text-sm shadow-sm"
            disabled={disabled || loading}
            aria-invalid={showError}
          />
        </div>
        <Button type="submit" className="h-11 sm:w-44" disabled={!valid || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          {loading ? "Analyzing…" : "Analyze"}
        </Button>
      </div>
      {showError && (
        <p className="mt-1.5 text-xs text-red-700 animate-fade-in">
          Not a valid EVM address (expected <span className="mono">0x</span> + 40 hex chars).
        </p>
      )}
    </form>
  );
}
