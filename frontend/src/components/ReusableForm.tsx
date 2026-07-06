import type { FormEvent, ReactNode } from "react";

interface ReusableFormProps {
  children: ReactNode;
  onSubmit: () => void;
}

export function ReusableForm({ children, onSubmit }: ReusableFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">{children}</form>;
}

