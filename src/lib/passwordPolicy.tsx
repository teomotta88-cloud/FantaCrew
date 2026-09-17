export type PasswordIssue = string;

export function validatePassword(pw: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (pw.length < 8) issues.push("Almeno 8 caratteri");
  if (!/[a-z]/.test(pw)) issues.push("Almeno una lettera minuscola");
  if (!/[A-Z]/.test(pw)) issues.push("Almeno una lettera maiuscola");
  if (!/[0-9]/.test(pw)) issues.push("Almeno un numero");
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push("Almeno un carattere speciale (es. !@#$)");
  const weak = [
    "password", "12345678", "qwerty", "111111", "abc123", "letmein", "iloveyou",
    "admin", "welcome", "monkey", "dragon", "master", "login", "passw0rd",
    "qwerty123", "1q2w3e4r", "1qaz2wsx", "zaq12wsx", "sunshine", "princess",
    "football", "baseball", "shadow", "superman", "batman", "trustno1",
  ];
  if (weak.some((w) => pw.toLowerCase().includes(w))) issues.push("Evita parole comuni o facili da indovinare");
  // Sequenze ovvie
  if (/(.)\1{3,}/.test(pw)) issues.push("Evita caratteri ripetuti (es. aaaa, 1111)");
  if (/0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf/i.test(pw)) {
    issues.push("Evita sequenze ovvie (es. 1234, abcd, qwerty)");
  }
  return issues;
}

export function PasswordHints({ password }: { password: string }) {
  const issues = validatePassword(password);
  if (!password) {
    return (
      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
        <li>Min. 8 caratteri, con maiuscola, minuscola, numero e carattere speciale.</li>
        <li>Evita password comuni o trapelate online — verranno rifiutate.</li>
      </ul>
    );
  }
  if (issues.length === 0) {
    return (
      <p className="text-xs text-green-600 mt-1">
        Criteri soddisfatti ✓ <span className="text-muted-foreground">(verrà inoltre verificata contro un database di password compromesse)</span>
      </p>
    );
  }
  return (
    <ul className="text-xs text-destructive mt-1 space-y-0.5 list-disc list-inside">
      {issues.map((i) => <li key={i}>{i}</li>)}
    </ul>
  );
}