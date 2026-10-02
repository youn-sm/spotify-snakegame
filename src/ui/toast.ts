let timer = 0;

export function toast(message: string): void {
  const box = document.getElementById('toast')!;
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(timer);
  timer = window.setTimeout(() => box.classList.remove('show'), 3500);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
