const COLOMBO = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const COLOMBO_LONG = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

export const formatColomboDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return COLOMBO.format(d);
};

export const formatColomboDateLong = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return COLOMBO_LONG.format(d);
};