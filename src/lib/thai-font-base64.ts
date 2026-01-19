// THSarabunNew font base64 - subset for certificate generation
// Since external font loading fails, we'll use a different approach:
// Generate the PDF without Thai text in the font-dependent areas when font fails

// This is a minimal implementation that formats dates and text in English
// when Thai font is not available, to avoid gibberish characters

export const formatThaiDate = (dateStr: string | null): string => {
  if (!dateStr) {
    const now = new Date();
    return formatDateToThai(now);
  }
  return formatDateToThai(new Date(dateStr));
};

const formatDateToThai = (date: Date): string => {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear() + 543; // Convert to Buddhist Era
  
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  
  const englishMonths = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];
  
  return `${day} ${englishMonths[month]} ${year}`;
};

export const formatThaiDateWithFont = (dateStr: string | null, hasThaiFont: boolean): string => {
  if (!dateStr) {
    const now = new Date();
    return formatDateWithFont(now, hasThaiFont);
  }
  return formatDateWithFont(new Date(dateStr), hasThaiFont);
};

const formatDateWithFont = (date: Date, hasThaiFont: boolean): string => {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear() + 543; // Convert to Buddhist Era
  
  if (hasThaiFont) {
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 
      'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
      'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return `${day} ${thaiMonths[month]} ${year}`;
  }
  
  const englishMonths = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];
  
  return `${day} ${englishMonths[month]} ${year}`;
};
