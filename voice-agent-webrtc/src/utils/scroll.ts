export function scrollHistoryToBottom(): void {
  const list = document.getElementById('history-list');
  if (!list) return;

  const host = list.parentElement as HTMLElement; // .history-content
  host.scrollTop = host.scrollHeight - host.clientHeight;
}
