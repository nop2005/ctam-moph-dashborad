import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import mophLogoUrl from '@/assets/moph-logo.png';

interface CertificateData {
  assessmentId: string;
  hospitalName: string;
  provinceName: string;
  healthRegionNumber: number;
  fiscalYear: number;
  assessmentPeriod: string;
  totalScore: number | null;
  quantitativeScore: number | null;
  qualitativeScore: number | null;
  impactScore: number | null;
  approvedAt: string | null;
}

// Helper function to load image as base64
const loadImageAsBase64 = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
};

// Load THSarabunNew font dynamically
const loadTHSarabunFont = async (): Promise<ArrayBuffer | null> => {
  try {
    // Try loading from various CDN sources
    const fontUrls = [
      'https://cdn.jsdelivr.net/gh/nicholashamilton/thai-fonts@master/TH%20Sarabun%20New/THSarabunNew.ttf',
      'https://raw.githubusercontent.com/nicholashamilton/thai-fonts/master/TH%20Sarabun%20New/THSarabunNew.ttf',
    ];

    for (const url of fontUrls) {
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          return await response.arrayBuffer();
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.warn('Could not load THSarabunNew font:', error);
    return null;
  }
};

// Convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Thai font embedding - using THSarabunNew
const addThaiFont = async (doc: jsPDF): Promise<boolean> => {
  try {
    const fontBuffer = await loadTHSarabunFont();
    if (fontBuffer) {
      const base64Font = arrayBufferToBase64(fontBuffer);
      doc.addFileToVFS('THSarabunNew.ttf', base64Font);
      doc.addFont('THSarabunNew.ttf', 'THSarabunNew', 'normal');
      doc.setFont('THSarabunNew');
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to add Thai font:', error);
    return false;
  }
};

export function useCertificatePdf() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateCertificate = async (data: CertificateData) => {
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Try to add Thai font
      const hasThaifont = await addThaiFont(doc);
      const fontName = hasThaifont ? 'THSarabunNew' : 'helvetica';

      // Load and add logo
      try {
        const logoBase64 = await loadImageAsBase64(mophLogoUrl);
        const logoSize = 25;
        doc.addImage(logoBase64, 'PNG', (pageWidth - logoSize) / 2, y, logoSize, logoSize);
        y += logoSize + 10;
      } catch (e) {
        console.warn('Could not load logo:', e);
        y += 10;
      }

      // Title - in Thai
      doc.setFontSize(hasThaifont ? 22 : 18);
      doc.setFont(fontName, 'normal');
      
      if (hasThaifont) {
        doc.text('ใบรับรองการประเมิน', pageWidth / 2, y, { align: 'center' });
        y += 10;
        doc.setFontSize(16);
        doc.text('การประเมินความมั่นคงปลอดภัยไซเบอร์ระบบเทคโนโลยีสารสนเทศ', pageWidth / 2, y, { align: 'center' });
        y += 8;
        doc.text('CTAM+ (Cybersecurity Assessment for Thai Health Sector)', pageWidth / 2, y, { align: 'center' });
      } else {
        doc.text('Certificate of Assessment', pageWidth / 2, y, { align: 'center' });
        y += 8;
        doc.setFontSize(14);
        doc.text('CTAM+ (Cybersecurity Assessment for Thai Health Sector)', pageWidth / 2, y, { align: 'center' });
      }
      y += 15;

      // Certificate number and date
      const certNumber = `CTAM-${data.fiscalYear + 543}-${data.assessmentPeriod}-${data.assessmentId.slice(0, 8).toUpperCase()}`;
      const issueDate = data.approvedAt 
        ? new Date(data.approvedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
      
      doc.setFontSize(hasThaifont ? 14 : 10);
      doc.setFont(fontName, 'normal');
      
      if (hasThaifont) {
        doc.text(`เลขที่ใบรับรอง: ${certNumber}`, margin, y);
        doc.text(`วันที่ออก: ${issueDate}`, pageWidth - margin, y, { align: 'right' });
      } else {
        doc.text(`Certificate No: ${certNumber}`, margin, y);
        doc.text(`Issue Date: ${issueDate}`, pageWidth - margin, y, { align: 'right' });
      }
      y += 15;

      // Horizontal line
      doc.setDrawColor(0, 128, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Certificate content
      doc.setFontSize(hasThaifont ? 16 : 12);
      doc.setFont(fontName, 'normal');
      
      if (hasThaifont) {
        doc.text('หนังสือรับรอง', pageWidth / 2, y, { align: 'center' });
      } else {
        doc.text('CERTIFICATE', pageWidth / 2, y, { align: 'center' });
      }
      y += 12;

      doc.setFontSize(hasThaifont ? 14 : 11);
      
      const wrapText = (text: string, maxWidth: number) => {
        return doc.splitTextToSize(text, maxWidth);
      };

      // Organization details
      if (hasThaifont) {
        doc.text('หนังสือฉบับนี้ขอรับรองว่า:', margin, y);
      } else {
        doc.text('This certificate is issued to certify that:', margin, y);
      }
      y += 10;

      doc.setFontSize(hasThaifont ? 16 : 14);
      if (hasThaifont) {
        doc.text(`หน่วยงาน: ${data.hospitalName}`, margin, y);
      } else {
        doc.text(`Organization: ${data.hospitalName}`, margin, y);
      }
      y += 8;

      doc.setFontSize(hasThaifont ? 14 : 11);
      if (hasThaifont) {
        doc.text(`จังหวัด: ${data.provinceName}`, margin, y);
        y += 7;
        doc.text(`เขตสุขภาพที่: ${data.healthRegionNumber}`, margin, y);
      } else {
        doc.text(`Province: ${data.provinceName}`, margin, y);
        y += 6;
        doc.text(`Health Region: ${data.healthRegionNumber}`, margin, y);
      }
      y += 12;

      // Assessment details
      let certText: string[];
      if (hasThaifont) {
        certText = wrapText(
          'ได้ผ่านการประเมินความมั่นคงปลอดภัยไซเบอร์ระบบเทคโนโลยีสารสนเทศสุขภาพ ตามกรอบมาตรฐาน CTAM+ (Cybersecurity Assessment for Thai Health Sector) โดยกระทรวงสาธารณสุข',
          pageWidth - margin * 2
        );
      } else {
        certText = wrapText(
          'has successfully completed the Cybersecurity Assessment for the Health Information Technology System according to the CTAM+ (Cybersecurity Assessment for Thai Health Sector) framework.',
          pageWidth - margin * 2
        );
      }
      doc.text(certText, margin, y);
      y += certText.length * (hasThaifont ? 7 : 5) + 10;

      // Assessment period
      doc.setFontSize(hasThaifont ? 14 : 11);
      if (hasThaifont) {
        doc.text(`รอบการประเมิน: ครั้งที่ ${data.assessmentPeriod} ปีงบประมาณ พ.ศ. ${data.fiscalYear + 543}`, margin, y);
      } else {
        doc.text(`Assessment Period: ${data.assessmentPeriod}/${data.fiscalYear + 543}`, margin, y);
      }
      y += 12;

      // Score box
      doc.setDrawColor(0, 100, 0);
      doc.setFillColor(240, 255, 240);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 50, 3, 3, 'FD');
      y += 10;

      doc.setFontSize(hasThaifont ? 16 : 12);
      if (hasThaifont) {
        doc.text('ผลการประเมิน', pageWidth / 2, y, { align: 'center' });
      } else {
        doc.text('Assessment Results', pageWidth / 2, y, { align: 'center' });
      }
      y += 10;

      doc.setFontSize(hasThaifont ? 14 : 11);
      
      const col1 = margin + 10;
      const col2 = pageWidth / 2 + 10;
      
      if (hasThaifont) {
        doc.text(`คะแนนเชิงปริมาณ (70%): ${data.quantitativeScore !== null ? Number(data.quantitativeScore).toFixed(2) : '-'} / 7.00`, col1, y);
        doc.text(`คะแนนเชิงคุณภาพ (15%): ${data.qualitativeScore !== null ? Number(data.qualitativeScore).toFixed(2) : '-'} / 1.50`, col2, y);
        y += 8;
        doc.text(`คะแนนผลกระทบ (15%): ${data.impactScore !== null ? Number(data.impactScore).toFixed(2) : '-'} / 1.50`, col1, y);
      } else {
        doc.text(`Quantitative Score (70%): ${data.quantitativeScore !== null ? Number(data.quantitativeScore).toFixed(2) : '-'} / 7.00`, col1, y);
        doc.text(`Qualitative Score (15%): ${data.qualitativeScore !== null ? Number(data.qualitativeScore).toFixed(2) : '-'} / 1.50`, col2, y);
        y += 7;
        doc.text(`Impact Score (15%): ${data.impactScore !== null ? Number(data.impactScore).toFixed(2) : '-'} / 1.50`, col1, y);
      }
      y += 12;

      doc.setFontSize(hasThaifont ? 18 : 14);
      doc.setTextColor(0, 100, 0);
      if (hasThaifont) {
        doc.text(`คะแนนรวม: ${data.totalScore !== null ? Number(data.totalScore).toFixed(2) : '-'} / 10.00`, pageWidth / 2, y, { align: 'center' });
      } else {
        doc.text(`Total Score: ${data.totalScore !== null ? Number(data.totalScore).toFixed(2) : '-'} / 10.00`, pageWidth / 2, y, { align: 'center' });
      }
      doc.setTextColor(0, 0, 0);
      y += 20;

      // Result status
      doc.setFontSize(hasThaifont ? 14 : 12);
      const passed = data.totalScore !== null && data.totalScore >= 5;
      if (passed) {
        doc.setTextColor(0, 128, 0);
        if (hasThaifont) {
          doc.text('[X] ผ่านเกณฑ์การประเมิน', margin, y);
          y += 7;
          doc.text('[  ] ผ่านโดยมีข้อเสนอแนะให้ปรับปรุง', margin, y);
        } else {
          doc.text('[X] Passed the assessment criteria', margin, y);
          y += 6;
          doc.text('[  ] Passed with recommendations for improvement', margin, y);
        }
      } else {
        if (hasThaifont) {
          doc.text('[  ] ผ่านเกณฑ์การประเมิน', margin, y);
          y += 7;
          doc.setTextColor(255, 140, 0);
          doc.text('[X] ผ่านโดยมีข้อเสนอแนะให้ปรับปรุง', margin, y);
        } else {
          doc.text('[  ] Passed the assessment criteria', margin, y);
          y += 6;
          doc.setTextColor(255, 140, 0);
          doc.text('[X] Passed with recommendations for improvement', margin, y);
        }
      }
      doc.setTextColor(0, 0, 0);
      y += 15;

      // Approval section
      doc.setFontSize(hasThaifont ? 14 : 11);
      if (hasThaifont) {
        doc.text('ตรวจสอบและรับรองโดย:', margin, y);
        y += 8;
        doc.text(`- สำนักงานสาธารณสุขจังหวัด${data.provinceName}`, margin + 5, y);
        y += 7;
        doc.text(`- สำนักงานเขตสุขภาพที่ ${data.healthRegionNumber}`, margin + 5, y);
      } else {
        doc.text('Assessed and certified by:', margin, y);
        y += 7;
        doc.text(`- Provincial Health Office of ${data.provinceName}`, margin + 5, y);
        y += 6;
        doc.text(`- Health Region ${data.healthRegionNumber}`, margin + 5, y);
      }
      y += 15;

      // Approval date
      if (data.approvedAt) {
        const approvalDate = new Date(data.approvedAt).toLocaleDateString('th-TH', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        if (hasThaifont) {
          doc.text(`วันที่อนุมัติ: ${approvalDate}`, margin, y);
        } else {
          doc.text(`Date of Approval: ${approvalDate}`, margin, y);
        }
      }
      y += 20;

      // Signature line
      doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
      y += 5;
      doc.setFontSize(hasThaifont ? 12 : 10);
      if (hasThaifont) {
        doc.text('ผู้ตรวจราชการกระทรวงสาธารณสุข', pageWidth - margin - 30, y, { align: 'center' });
        y += 6;
        doc.text(`เขตสุขภาพที่ ${data.healthRegionNumber}`, pageWidth - margin - 30, y, { align: 'center' });
      } else {
        doc.text('Regional Health Officer', pageWidth - margin - 30, y, { align: 'center' });
        y += 5;
        doc.text(`Health Region ${data.healthRegionNumber}`, pageWidth - margin - 30, y, { align: 'center' });
      }

      // Footer
      const footerY = doc.internal.pageSize.getHeight() - 15;
      doc.setFontSize(hasThaifont ? 10 : 8);
      doc.setTextColor(128, 128, 128);
      if (hasThaifont) {
        doc.text(
          'ใบรับรองนี้ออกโดยระบบประเมินความมั่นคงปลอดภัยไซเบอร์ CTAM+ กระทรวงสาธารณสุข',
          pageWidth / 2,
          footerY,
          { align: 'center' }
        );
      } else {
        doc.text(
          'This certificate was generated by CTAM+ Cybersecurity Assessment System, Ministry of Public Health, Thailand',
          pageWidth / 2,
          footerY,
          { align: 'center' }
        );
      }
      doc.text(
        `Document ID: ${data.assessmentId}`,
        pageWidth / 2,
        footerY + 4,
        { align: 'center' }
      );

      // Download
      const fileName = `ใบรับรอง_${data.hospitalName.replace(/\s/g, '_')}_${data.assessmentPeriod}_${data.fiscalYear + 543}.pdf`;
      doc.save(fileName);
      
      return true;
    } catch (error) {
      console.error('Error generating certificate:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchAndGenerateCertificate = async (assessmentId: string) => {
    setIsGenerating(true);
    
    try {
      // Fetch assessment with hospital/health_office and province data
      const { data: assessment, error } = await supabase
        .from('assessments')
        .select(`
          id,
          fiscal_year,
          assessment_period,
          total_score,
          quantitative_score,
          qualitative_score,
          impact_score,
          regional_approved_at,
          hospital_id,
          health_office_id,
          hospitals!assessments_hospital_id_fkey (
            name,
            province_id,
            provinces!hospitals_province_id_fkey (
              name,
              health_region_id,
              health_regions!provinces_health_region_id_fkey (
                region_number
              )
            )
          ),
          health_offices (
            name,
            province_id,
            health_region_id,
            provinces!health_offices_province_id_fkey (
              name
            ),
            health_regions!health_offices_health_region_id_fkey (
              region_number
            )
          )
        `)
        .eq('id', assessmentId)
        .single();

      if (error || !assessment) {
        throw new Error('Failed to fetch assessment data');
      }

      let hospitalName = '-';
      let provinceName = '-';
      let healthRegionNumber = 0;

      if (assessment.hospital_id && assessment.hospitals) {
        const hospital = assessment.hospitals as any;
        hospitalName = hospital.name || '-';
        provinceName = hospital.provinces?.name || '-';
        healthRegionNumber = hospital.provinces?.health_regions?.region_number || 0;
      } else if (assessment.health_office_id && assessment.health_offices) {
        const office = assessment.health_offices as any;
        hospitalName = office.name || '-';
        provinceName = office.provinces?.name || '-';
        healthRegionNumber = office.health_regions?.region_number || 0;
      }

      await generateCertificate({
        assessmentId: assessment.id,
        hospitalName,
        provinceName,
        healthRegionNumber,
        fiscalYear: assessment.fiscal_year,
        assessmentPeriod: assessment.assessment_period,
        totalScore: assessment.total_score,
        quantitativeScore: assessment.quantitative_score,
        qualitativeScore: assessment.qualitative_score,
        impactScore: assessment.impact_score,
        approvedAt: assessment.regional_approved_at,
      });

      return true;
    } catch (error) {
      console.error('Error fetching and generating certificate:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    generateCertificate,
    fetchAndGenerateCertificate,
  };
}
