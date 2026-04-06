import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

const PAPER_SIZES = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
};

function getPaperDimensions(paperSize, orientation = 'portrait') {
  const { width, height } = PAPER_SIZES[paperSize];
  return orientation === 'landscape'
    ? { width: height, height: width }
    : { width, height };
}

/**
 * 페이지 DOM 요소 배열 → 다중 페이지 PDF 저장
 * @param {HTMLElement[]} elements  - 페이지별 DOM 요소 배열
 * @param {string}        fileName
 * @param {string}        paperSize   - 'A4' | 'A3'
 * @param {string}        orientation - 'portrait' | 'landscape'
 */
export async function generatePDF(elements, fileName = '콘티.pdf', paperSize = 'A4', orientation = 'portrait') {
  const { width, height } = getPaperDimensions(paperSize, orientation);

  const pdf = new jsPDF({
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [width, height],
  });

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;

    // 각 페이지를 고해상도 캔버스로 변환
    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    // 첫 페이지는 이미 생성된 페이지 사용, 이후는 새 페이지 추가
    if (i > 0) pdf.addPage([width, height]);
    pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
  }

  pdf.save(fileName);
}

/**
 * 다중 페이지 PDF 미리보기 URL 생성
 */
export async function previewPDF(elements, paperSize = 'A4', orientation = 'portrait') {
  const { width, height } = getPaperDimensions(paperSize, orientation);

  const pdf = new jsPDF({
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [width, height],
  });

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.9);

    if (i > 0) pdf.addPage([width, height]);
    pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
  }

  const blob = pdf.output('blob');
  return URL.createObjectURL(blob);
}
