import { AlertCircle } from "lucide-react";

interface AuthErrorMessageProps {
  message: string;
}

export function AuthErrorMessage({ message }: AuthErrorMessageProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

