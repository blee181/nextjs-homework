"use client";

import { useFormStatus } from "react-dom";

export default function GenerateButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Generating…" : "Generate caption"}
    </button>
  );
}
