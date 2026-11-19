/* Invoice helpers: amount in words (Indian numbering), GST split, PDF export. */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
  'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
}
function threeDigits(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
}

/** 3747 → "Rupees Three Thousand Seven Hundred Forty-Seven Only" (crore / lakh / thousand) */
export function amountInWords(amount) {
  const rupees = Math.floor(Math.abs(Number(amount) || 0));
  const paise = Math.round((Math.abs(Number(amount) || 0) - rupees) * 100);
  if (!rupees && !paise) return 'Rupees Zero Only';
  const parts = [];
  let n = rupees;
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  let words = `Rupees ${parts.join(' ')}`;
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
}

/**
 * Prices are GST-inclusive. Returns null when no GST rate is set.
 * Same state as the seller → CGST + SGST, otherwise IGST.
 */
export function gstBreakdown(total, settings, address) {
  const rate = Number(settings?.gstRate) || 0;
  if (!rate) return null;
  const taxable = Math.round((total / (1 + rate / 100)) * 100) / 100;
  const tax = Math.round((total - taxable) * 100) / 100;
  const intra = !!settings.state && (address?.state || '').trim().toLowerCase() === settings.state.trim().toLowerCase();
  return { rate, taxable, tax, intra, half: Math.round((tax / 2) * 100) / 100 };
}

export const money = (n, decimals = false) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 }).format(Number(n) || 0);

export const TEMPLATES = [
  { id: 'classic', label: 'Classic', hint: 'Brand header, A4' },
  { id: 'modern', label: 'Modern', hint: 'Minimal, A4' },
  { id: 'compact', label: 'Compact', hint: 'Receipt, 80 mm' },
];

/** Renders the invoice element to a PDF and downloads it. A4 for classic/modern, an 80 mm roll for compact. */
export async function downloadPdf(el, filename, template) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  const img = canvas.toDataURL('image/jpeg', 0.95);

  if (template === 'compact') {
    const w = 80;
    const h = (canvas.height * w) / canvas.width;
    const pdf = new jsPDF({ unit: 'mm', format: [w, h], orientation: 'portrait' });
    pdf.addImage(img, 'JPEG', 0, 0, w, h);
    pdf.save(filename);
    return;
  }

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = 210;
  const pageH = 297;
  const imgH = (canvas.height * pageW) / canvas.width;
  let y = 0;
  pdf.addImage(img, 'JPEG', 0, y, pageW, imgH);
  // long invoices continue on extra pages
  while (imgH + y > pageH + 0.5) {
    y -= pageH;
    pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, y, pageW, imgH);
  }
  pdf.save(filename);
}
