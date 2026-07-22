'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Lab to RGB color conversion
function labToRgb(l: number, a: number, b: number): string {
  // Lab to XYZ conversion
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  const xn = 0.95047;
  const yn = 1.00000;
  const zn = 1.08883;

  x = xn * (x * x * x > 0.008856 ? x * x * x : (x - 16 / 116) / 7.787);
  y = yn * (y * y * y > 0.008856 ? y * y * y : (y - 16 / 116) / 7.787);
  z = zn * (z * z * z > 0.008856 ? z * z * z : (z - 16 / 116) / 7.787);

  // XYZ to RGB conversion
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let b_val = x * 0.0557 + y * -0.2040 + z * 1.0570;

  // Apply gamma correction
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b_val = b_val > 0.0031308 ? 1.055 * Math.pow(b_val, 1 / 2.4) - 0.055 : 12.92 * b_val;

  // Clamp to 0-1 and convert to 0-255
  r = Math.max(0, Math.min(1, r)) * 255;
  g = Math.max(0, Math.min(1, g)) * 255;
  b_val = Math.max(0, Math.min(1, b_val)) * 255;

  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b_val)})`;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  tripDestination: string;
  tripStatus: 'Completed' | 'Upcoming' | 'Ongoing';
  clientName: string;
  mobileNumber: string;
  address: string;
  packageDestination: string;
  packageStartDate: string;
  packageEndDate: string;
  numberOfMembers: number;
  totalPackagePrice: number;
  advancePaid: number;
  advancePaidDate: string;
  discount: number;
  payments: Payment[];
  termsConditions: string;
}

export default function InvoiceGenerator() {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [formData, setFormData] = useState<InvoiceData>({
    invoiceNumber: '',
    invoiceDate: '',
    tripDestination: '',
    tripStatus: 'Upcoming',
    clientName: '',
    mobileNumber: '',
    address: '',
    packageDestination: '',
    packageStartDate: '',
    packageEndDate: '',
    numberOfMembers: 0,
    totalPackagePrice: 0,
    advancePaid: 0,
    advancePaidDate: '',
    discount: 0,
    payments: [],
    termsConditions: `
Payment Terms

• 40% Advance payment must be made on or before booking confirmation.
• Remaining amount to be paid on or before the travel date.

Cancellation Policy

• Cancellation made before 7 days of the journey date: 75% of the total package amount will be deducted.
• Cancellation made before 3 days of the journey date: 100% of the total package amount will be deducted.
• No refund will be provided for last-minute cancellations or no-shows.
• Refunds, if applicable, will be processed within 7–10 working days.

Terms and Conditions

• The quotation is based on the details provided by the client and is valid only for the mentioned dates.
• Guide charges must be paid; otherwise, guidance will be provided remotely.
• Rates are applicable for group bookings; changes in participants may affect the cost.
• Hotel check-in and check-out timings are subject to hotel policies.
• Rooms will be provided on a sharing basis as per availability.
• Sightseeing will be covered as per itinerary; sequence may change due to conditions.
• The company is not responsible for delays due to natural or unforeseen circumstances.
• Personal expenses are not included unless mentioned.
• Clients must carry valid government-issued ID proof.
• Any damages will be chargeable to the client.
• Management reserves the right to modify the itinerary.

Important Notes

• Rates are calculated based on group size.
• Changes in itinerary may affect the cost.
• Entry tickets and personal expenses are not included.
`,
  });

  const handleInputChange = (
    field: keyof Omit<InvoiceData, 'payments'>,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePaymentChange = (
    id: string,
    field: 'amount' | 'date',
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      payments: prev.payments.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    }));
  };

  const addPayment = () => {
    const newPayment: Payment = {
      id: Date.now().toString(),
      amount: 0,
      date: new Date().toISOString().split('T')[0],
    };
    setFormData((prev) => ({
      ...prev,
      payments: [...prev.payments, newPayment],
    }));
  };

  const removePayment = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== id),
    }));
  };

  const logInvoiceToGoogleSheet = async () => {
    const payload = {
      ...formData,
      balance: calculateBalance(),
      totalReceived: calculateTotalReceived(),
    };

    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Google Sheets save failed');
    }

    return true;
  };

  const saveFormDataToSheet = async () => {
    setSaveState('saving');
    setSaveError('');

    try {
      await logInvoiceToGoogleSheet();
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const calculateBalance = () => {
    const totalPaid = formData.advancePaid + formData.payments.reduce((sum, p) => sum + (parseFloat(String(p.amount)) || 0), 0);
    return Math.max(0, formData.totalPackagePrice - formData.discount - totalPaid);
  };

  const calculateTotalReceived = () => {
    return formData.totalPackagePrice - formData.discount;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  const downloadPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = 210;
      const pageH = 297;
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      // ── helpers ──────────────────────────────────────────────────
      const checkNewPage = (needed: number) => {
        if (y + needed > pageH - 20) {
          pdf.addPage();
          y = margin;
        }
      };

      const sectionLine = () => {
        checkNewPage(6);
        pdf.setDrawColor(180);
        pdf.setLineWidth(0.3);
        pdf.line(margin, y, pageW - margin, y);
        y += 5;
      };

      const boldText = (text: string, x: number, yPos: number, size = 10) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(size);
        pdf.text(text, x, yPos);
      };

      const normalText = (text: string, x: number, yPos: number, size = 10) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(size);
        pdf.text(text, x, yPos);
      };

      const labelValue = (label: string, value: string, x: number, maxW: number) => {
        checkNewPage(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        pdf.text(label, x, y);
        y += 4;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(0);
        pdf.text(value || '-', x, y, { maxWidth: maxW });
        y += 6;
      };

      const tableRow = (
        label: string,
        value: string,
        isRed = false,
        isBlue = false,
        isBoldVal = false
      ) => {
        checkNewPage(10);
        // row background
        pdf.setFillColor(248, 248, 248);
        pdf.rect(margin, y - 4, contentW * 0.55, 8, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.rect(margin + contentW * 0.55, y - 4, contentW * 0.45, 8, 'F');
        // borders
        pdf.setDrawColor(200);
        pdf.setLineWidth(0.2);
        pdf.rect(margin, y - 4, contentW, 8);
        pdf.line(margin + contentW * 0.55, y - 4, margin + contentW * 0.55, y + 4);
        // label
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(80);
        pdf.text(label, margin + 2, y + 0.5);
        // value
        if (isRed) pdf.setTextColor(180, 0, 0);
        else if (isBlue) pdf.setTextColor(0, 80, 180);
        else pdf.setTextColor(0);
        pdf.setFont('helvetica', isBoldVal ? 'bold' : 'normal');
        pdf.setFontSize(9);
        pdf.text(value, pageW - margin - 2, y + 0.5, { align: 'right' });
        pdf.setTextColor(0);
        y += 8;
      };

      const summaryRow = (
        label: string,
        value: string,
        highlight = false,
        isBlue = false
      ) => {
        checkNewPage(10);
        if (highlight) {
          pdf.setFillColor(230, 242, 255);
          pdf.rect(margin, y - 4, contentW, 8, 'F');
        } else {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(margin, y - 4, contentW * 0.65, 8, 'F');
        }
        pdf.setDrawColor(200);
        pdf.setLineWidth(0.2);
        pdf.rect(margin, y - 4, contentW, 8);
        pdf.line(margin + contentW * 0.65, y - 4, margin + contentW * 0.65, y + 4);
        pdf.setFont('helvetica', highlight ? 'bold' : 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(highlight ? 0 : 80);
        pdf.text(label, margin + 2, y + 0.5);
        if (isBlue) pdf.setTextColor(0, 80, 180);
        else pdf.setTextColor(0);
        pdf.setFont('helvetica', highlight ? 'bold' : 'normal');
        pdf.text(value, pageW - margin - 2, y + 0.5, { align: 'right' });
        pdf.setTextColor(0);
        y += 8;
      };

      // ── HEADER ───────────────────────────────────────────────────
      // Try to load logo
      try {
        const logoRes = await fetch('https://adnadventures.com/logo/logo.jpeg');
        if (logoRes.ok) {
          const blob = await logoRes.blob();
          const base64 = await new Promise<string>((res) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.readAsDataURL(blob);
          });
          pdf.addImage(base64, 'JPEG', margin, y, 20, 20);
        }
      } catch (_) { /* no logo, skip */ }

      // Company name centered
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(0);
      pdf.text('ADN ADVENTURES', pageW / 2, y + 7, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(80);
      pdf.text('TOURS & TRAVELS', pageW / 2, y + 13, { align: 'center' });
      pdf.setFontSize(8);
      pdf.setTextColor(130);
      pdf.text('Travel Invoice / Payment Receipt', pageW / 2, y + 18, { align: 'center' });
      pdf.setTextColor(0);

      y += 24;
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.6);
      pdf.line(margin, y, pageW - margin, y);
      y += 8;

      // ── INVOICE META ─────────────────────────────────────────────
      const col2 = margin + contentW / 2 + 5;
      const colW = contentW / 2 - 5;

      // Row 1
      const ySnap = y;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text('Invoice No', margin, y);
      pdf.text('Invoice Date', col2, y);
      y += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0);
      pdf.text(formData.invoiceNumber || '-', margin, y);
      pdf.text(formatDate(formData.invoiceDate) || '-', col2, y);
      y += 7;

      // Row 2
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text('Trip Destination', margin, y);
      pdf.text('Trip Status', col2, y);
      y += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0);
      pdf.text(formData.tripDestination || '-', margin, y);
      pdf.text(formData.tripStatus || '-', col2, y);
      y += 8;

      sectionLine();

      // ── CLIENT DETAILS ───────────────────────────────────────────
      boldText('Client Details', margin, y, 11);
      y += 6;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold'); pdf.text('Name:', margin, y);
      pdf.setFont('helvetica', 'normal'); pdf.text(formData.clientName || '-', margin + 14, y);
      y += 5;
      pdf.setFont('helvetica', 'bold'); pdf.text('Mobile:', margin, y);
      pdf.setFont('helvetica', 'normal'); pdf.text(formData.mobileNumber || '-', margin + 14, y);
      y += 5;
      pdf.setFont('helvetica', 'bold'); pdf.text('Address:', margin, y);
      pdf.setFont('helvetica', 'normal');
      const addrLines = pdf.splitTextToSize(formData.address || '-', contentW - 20);
      pdf.text(addrLines, margin + 18, y);
      y += addrLines.length * 5;

      sectionLine();

      // ── PACKAGE DETAILS ──────────────────────────────────────────
      checkNewPage(12);
      boldText('Package Details', margin, y, 11);
      y += 7;

      tableRow('Package Destination', formData.packageDestination || '-');
      tableRow('Package Date', `${formatDate(formData.packageStartDate)} to ${formatDate(formData.packageEndDate)}`);
      tableRow('Number of Members', `${formData.numberOfMembers} Members`);
      tableRow('Total Package Price', `Rs. ${formData.totalPackagePrice.toLocaleString()}`);
      tableRow('Advance Paid', `Rs. ${formData.advancePaid.toLocaleString()}`);
      tableRow('Advance Paid Date', formatDate(formData.advancePaidDate) || '-');
      formData.payments.forEach((payment, index) => {
        tableRow(
          `Payment ${index + 1}`,
          `Rs. ${parseFloat(String(payment.amount)).toLocaleString()} (${formatDate(payment.date)})`
        );
      });
      tableRow('Discount', `Rs. ${formData.discount.toLocaleString()}`);
      tableRow('Remaining Balance', `Rs. ${calculateBalance().toLocaleString()}`, true, false, true);

      y += 4;
      sectionLine();

      // ── PAYMENT SUMMARY ──────────────────────────────────────────
      checkNewPage(12);
      boldText('Payment Summary', margin, y, 11);
      y += 7;

      summaryRow('Total Package Amount', `Rs. ${formData.totalPackagePrice.toLocaleString()}`);
      summaryRow('Discount Applied', `- Rs. ${formData.discount.toLocaleString()}`);
      summaryRow('Advance Payment Received', `Rs. ${formData.advancePaid.toLocaleString()}`);
      formData.payments.forEach((payment, index) => {
        summaryRow(
          `Payment ${index + 1} Received`,
          `Rs. ${parseFloat(String(payment.amount)).toLocaleString()}`
        );
      });
      summaryRow('Total Amount Received', `Rs. ${calculateTotalReceived().toLocaleString()}`, true, true);

      y += 4;
      sectionLine();

      // ── TERMS & CONDITIONS ────────────────────────────────────────────
      if (formData.termsConditions) {
        checkNewPage(12);
        boldText('Terms & Conditions', margin, y, 11);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(60);
        formData.termsConditions.split('\n').forEach(line => {
          checkNewPage(6);
          const wrapped = pdf.splitTextToSize(`${line}`, contentW);
          pdf.text(wrapped, margin, y);
          y += wrapped.length * 5;
        });
        pdf.setTextColor(0);
        y += 4;
        sectionLine();
      }

      // ── SIGNATURE + FOOTER ───────────────────────────────────────
      // Measure what we need: signature block (~30) + footer (~16)
      const signatureFooterHeight = 50;
      checkNewPage(signatureFooterHeight);

      // Signature on the right
      y += 6;
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.3);
      pdf.line(pageW - margin - 45, y, pageW - margin, y);
      y += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(0);
      pdf.text('Authorized Signature', pageW - margin, y, { align: 'right' });

      // Footer pinned with a gap
      y += 16;
      pdf.setDrawColor(180);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, pageW - margin, y);
      y += 7;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0);
      pdf.text('Thank You & Have a Great Journey Ahead!', pageW / 2, y, { align: 'center' });


      // Attach uploaded documents
      for (const file of attachments) {

        pdf.addPage();

        if (file.type.startsWith("image/")) {

          const imgData = await new Promise<string>((resolve) => {
            const reader = new FileReader();

            reader.onload = () =>
              resolve(reader.result as string);

            reader.readAsDataURL(file);
          });


          pdf.addImage(
            imgData,
            "JPEG",
            10,
            10,
            190,
            270
          );

        } else if (file.type === "application/pdf") {

          const pdfBytes = await file.arrayBuffer();

          const blobUrl =
            URL.createObjectURL(
              new Blob(
                [pdfBytes],
                { type: "application/pdf" }
              )
            );

          pdf.text(
            `Attached PDF: ${file.name}`,
            20,
            20
          );

          pdf.text(
            blobUrl,
            20,
            30
          );
        }
      }

      // ── SAVE ─────────────────────────────────────────────────────
      // With this:
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // iOS Safari: open blob URL in new tab — user can then tap Share → Save to Files
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } else {
        pdf.save(`Invoice-${formData.invoiceNumber}.pdf`);
      }

      // Save the full invoice data to Google Sheets behind the server webhook.
      try {
        await logInvoiceToGoogleSheet();
      } catch (logError) {
        console.warn('Sheet logging failed (non-critical):', logError);
      }

    } catch (error) {
      console.error('PDF generation error:', error);
      alert(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <style>{`
        @supports not (color: lab(0% 0 0)) {
          .invoice-container { /* no-op */ }
        }
        .invoice-container {
          color-scheme: light;
        }
      `}</style>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          Travel Invoice Generator
        </h1>
        <p className="text-slate-600 mb-8">
          Create and download professional travel invoices with dynamic payment tracking
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Panel */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Invoice Details
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={(e) =>
                      handleInputChange('invoiceNumber', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) =>
                      handleInputChange('invoiceDate', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="tripDestination">Trip Destination</Label>
                  <Input
                    id="tripDestination"
                    value={formData.tripDestination}
                    onChange={(e) =>
                      handleInputChange('tripDestination', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="tripStatus">Trip Status</Label>
                  <Select
                    value={formData.tripStatus}
                    onValueChange={(value) =>
                      handleInputChange(
                        'tripStatus',
                        value as 'Completed' | 'Upcoming' | 'Ongoing'
                      )
                    }
                  >
                    <SelectTrigger id="tripStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Upcoming">Upcoming</SelectItem>
                      <SelectItem value="Ongoing">Ongoing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Client Details
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) =>
                      handleInputChange('clientName', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="mobileNumber">Mobile Number</Label>
                  <Input
                    id="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={(e) =>
                      handleInputChange('mobileNumber', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      handleInputChange('address', e.target.value)
                    }
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Package Details
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="packageDestination">Package Destination</Label>
                  <Input
                    id="packageDestination"
                    value={formData.packageDestination}
                    onChange={(e) =>
                      handleInputChange('packageDestination', e.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="packageStartDate">Package Start Date</Label>
                    <Input
                      id="packageStartDate"
                      type="date"
                      value={formData.packageStartDate}
                      onChange={(e) =>
                        handleInputChange('packageStartDate', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="packageEndDate">Package End Date</Label>
                    <Input
                      id="packageEndDate"
                      type="date"
                      value={formData.packageEndDate}
                      onChange={(e) =>
                        handleInputChange('packageEndDate', e.target.value)
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="numberOfMembers">Number of Members</Label>
                  <Input
                    id="numberOfMembers"
                    type="number"
                    value={formData.numberOfMembers}
                    onChange={(e) =>
                      handleInputChange('numberOfMembers', parseInt(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="totalPackagePrice">
                    Total Package Price (₹)
                  </Label>
                  <Input
                    id="totalPackagePrice"
                    type="number"
                    value={formData.totalPackagePrice}
                    onChange={(e) =>
                      handleInputChange('totalPackagePrice', parseFloat(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="discount">Discount (₹)</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={formData.discount}
                    onChange={(e) =>
                      handleInputChange('discount', parseFloat(e.target.value))
                    }
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Payments</h2>
                <Button
                  onClick={addPayment}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3 items-end bg-blue-50 p-3 rounded border border-blue-200">
                  <div className="flex-1">
                    <Label className="text-xs font-semibold text-blue-800">
                      Advance Paid (₹)
                    </Label>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={formData.advancePaid || ''}
                      onChange={(e) =>
                        handleInputChange('advancePaid', parseFloat(e.target.value) || 0)
                      }
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs font-semibold text-blue-800">
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={formData.advancePaidDate}
                      onChange={(e) =>
                        handleInputChange('advancePaidDate', e.target.value)
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                {formData.payments.map((payment, index) => (
                  <div
                    key={payment.id}
                    className="flex gap-3 items-end bg-slate-50 p-3 rounded border border-slate-200"
                  >
                    <div className="flex-1">
                      <Label className="text-xs">Payment {index + 1}</Label>
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={payment.amount || ''}
                        onChange={(e) =>
                          handlePaymentChange(
                            payment.id,
                            'amount',
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={payment.date}
                        onChange={(e) =>
                          handlePaymentChange(payment.id, 'date', e.target.value)
                        }
                      />
                    </div>
                    <Button
                      onClick={() => removePayment(payment.id)}
                      size="sm"
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                <div className="bg-amber-50 p-3 rounded border border-amber-200 mt-4">
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">Remaining Balance:</span> ₹
                    {calculateBalance().toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">

              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Terms & Conditions
              </h2>

              <Textarea
                value={formData.termsConditions}
                onChange={(e) =>
                  handleInputChange(
                    'termsConditions',
                    e.target.value
                  )
                }
                rows={12}
              />

            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Attach Documents
              </h2>

              <Input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => {
                  if (e.target.files) {
                    const newFiles = Array.from(e.target.files);

                    setAttachments((prev) => [
                      ...prev,
                      ...newFiles
                    ]);
                  }

                  // allow selecting same file again
                  e.target.value = "";
                }}
              />

              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex justify-between bg-slate-100 p-2 rounded"
                >

                  <span>
                    📎 {file.name}
                  </span>

                  <button
                    onClick={() => {
                      setAttachments(prev =>
                        prev.filter((_, i) => i !== index)
                      )
                    }}
                    className="text-red-600"
                  >
                    Remove
                  </button>

                </div>
              ))}
            </Card>

            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <Button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex-1 bg-slate-800 hover:bg-slate-900"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {showPreview ? 'Hide' : 'Show'} Preview
                </Button>
                <Button
                  onClick={saveFormDataToSheet}
                  disabled={saveState === 'saving'}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {saveState === 'saving' ? 'Saving...' : 'Save to Google Sheets'}
                </Button>
              </div>
              <Button
                onClick={downloadPDF}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              {saveState === 'saved' && (
                <p className="text-sm text-emerald-700">Form data saved to Google Sheets.</p>
              )}
              {saveState === 'error' && (
                <p className="text-sm text-red-700">Unable to save to Sheets: {saveError}</p>
              )}
            </div>
          </div>

          {/* Invoice Preview */}
          {showPreview && (
            <div className="lg:sticky lg:top-8 lg:h-fit">
              <div
                ref={invoiceRef}
                className="invoice-container bg-white p-8 rounded-lg shadow-lg border border-slate-200 flex flex-col min-h-[297mm]"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {/* Header */}
                {/* <div className="text-center border-b-2 border-slate-900 pb-4">
                  <h1 className="text-3xl font-bold text-slate-900">
                    ADN ADVENTURES TOURS & TRAVELS
                  </h1>
                  <p className="text-lg text-slate-600 mt-1">
                    Travel Invoice / Payment Receipt
                  </p>
                </div> */}

                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-4">
                  <div className="flex items-center gap-6">
                    {/* Logo */}
                    <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-xl">
                      <img
                        src="https://adnadventures.com/logo/logo.jpeg"
                        alt="ADN Adventures Logo"
                        className="w-full h-full object-contain rounded-xl"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    {/* Title */}
                    <div className="flex-1 text-center">
                      <h1 className="text-3xl font-bold text-slate-900 tracking-wide">
                        ADN ADVENTURES
                      </h1>
                      <p className="text-xl text-slate-600 tracking-widest mt-0.5">
                        TOURS & TRAVELS
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Travel Invoice / Payment Receipt
                      </p>
                    </div>
                    {/* Spacer to balance logo */}
                    <div className="w-20 flex-shrink-0" />
                  </div>
                </div>

                {/* Invoice Meta */}
                <div className="space-y-3 border-b border-slate-300 pb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Invoice No</p>
                      <p className="font-semibold text-slate-900">
                        {formData.invoiceNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-600">Invoice Date</p>
                      <p className="font-semibold text-slate-900">
                        {formatDate(formData.invoiceDate)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Trip Destination</p>
                      <p className="font-semibold text-slate-900">
                        {formData.tripDestination}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-600">Trip Status</p>
                      <p className="font-semibold text-slate-900">
                        {formData.tripStatus}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Client Details */}
                <div className="space-y-2 border-b border-slate-300 pb-4">
                  <h3 className="font-bold text-slate-900">Client Details</h3>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Name:</span>{' '}
                    {formData.clientName}
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Mobile:</span>{' '}
                    {formData.mobileNumber}
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Address:</span>{' '}
                    {formData.address}
                  </p>
                </div>

                {/* Package Details Table */}
                <div className="space-y-2 border-b border-slate-300 pb-4">
                  <h3 className="font-bold text-slate-900">Package Details</h3>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Package Destination
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-900">
                          {formData.packageDestination}
                        </td>
                      </tr>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Package Date
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-900">
                          {formatDate(formData.packageStartDate)} to{' '}
                          {formatDate(formData.packageEndDate)}
                        </td>
                      </tr>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Number of Members
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-900">
                          {formData.numberOfMembers} Members
                        </td>
                      </tr>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Total Package Price
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-900">
                          ₹{formData.totalPackagePrice.toLocaleString()}
                        </td>
                      </tr>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Advance Paid
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-900">
                          ₹{formData.advancePaid.toLocaleString()}
                        </td>
                      </tr>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Advance Paid Date
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-900">
                          {formatDate(formData.advancePaidDate)}
                        </td>
                      </tr>
                      {formData.payments.map((payment, index) => (
                        <tr key={payment.id} className="border border-slate-300">
                          <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                            Payment {index + 1}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-slate-900">
                            ₹{parseFloat(String(payment.amount)).toLocaleString()}{' '}
                            ({formatDate(payment.date)})
                          </td>
                        </tr>
                      ))}
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Discount
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-900">
                          ₹{formData.discount.toLocaleString()}
                        </td>
                      </tr>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Remaining Balance
                        </td>
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-red-600">
                          ₹{calculateBalance().toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Payment Summary */}
                <div className="space-y-2 border-b border-slate-300 pb-4">
                  <h3 className="font-bold text-slate-900">Payment Summary</h3>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Total Package Amount
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">
                          ₹{formData.totalPackagePrice.toLocaleString()}
                        </td>
                      </tr>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Discount Applied
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">
                          - ₹{formData.discount.toLocaleString()}
                        </td>
                      </tr>
                      <tr className="border border-slate-300">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                          Advance Payment Received
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">
                          ₹{formData.advancePaid.toLocaleString()}
                        </td>
                      </tr>
                      {formData.payments.map((payment, index) => (
                        <tr key={payment.id} className="border border-slate-300">
                          <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                            Payment {index + 1} Received
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">
                            ₹{parseFloat(String(payment.amount)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="border border-slate-300 bg-blue-50">
                        <td className="border border-slate-300 px-3 py-2 font-bold text-slate-900">
                          Total Amount Received
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-right font-bold text-blue-600">
                          ₹{calculateTotalReceived().toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Terms & Conditions */}
                {formData.termsConditions && (
                  <div className="space-y-2 border-b border-slate-300 pb-4">
                    <h3 className="font-bold text-slate-900">Terms & Conditions</h3>
                    <ul className="text-sm text-slate-700 space-y-1">
                      {formData.termsConditions.split('\n').map((term, index) => (
                        <li key={index}>{term}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer */}
                {/* Footer */}
                <div className="space-y-6 pt-4">
                  <div className="text-right">
                    <div className="flex flex-col items-end mb-0">
                      <img
                        src="/signature.png"
                        alt="Authorized Signature"
                        className="h-40 md:h-40 w-auto mr-8 object-contain"
                      />
                    </div>
                    <p className="text-sm text-slate-600 mb-8">________________________</p>
                    <p className="text-sm font-semibold text-slate-900">Authorized Signature</p>
                  </div>
                </div>

                {/* Sticky footer — outside the space-y-6 sections */}
                <div className="mt-auto pt-8 border-t border-slate-200">
                  <p className="text-center text-sm font-semibold text-slate-900">
                    Thank You & Have a Great Journey Ahead!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
