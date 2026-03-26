export function sanitizeText(input: string): string {
  if (!input) return "";
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    "/": '&#x2F;',
  };
  const reg = /[&<>"'/]/ig;
  return input.replace(reg, (match) => (map[match]));
}

export function validateOrderItems(items: any[]): boolean {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) return false;
  
  for (const item of items) {
    if (typeof item.price !== 'number' || item.price < 0) return false;
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || item.quantity > 50) return false;
    if (!item.name || typeof item.name !== 'string' || item.name.length > 100) return false;
  }
  
  return true;
}
