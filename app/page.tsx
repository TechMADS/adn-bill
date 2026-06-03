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
  notes: string;
}

export default function InvoiceGenerator() {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [formData, setFormData] = useState<InvoiceData>({
    invoiceNumber: 'ADN2026-024',
    invoiceDate: '2026-05-18',
    tripDestination: 'Vagamon',
    tripStatus: 'Completed',
    clientName: 'Giri',
    mobileNumber: '+91 82200 40106',
    address: '24, Meenatchiaman Koil Street, Thondamanatham, Puducherry - 605502',
    packageDestination: 'Vagamon',
    packageStartDate: '2026-05-17',
    packageEndDate: '2026-05-18',
    numberOfMembers: 4,
    totalPackagePrice: 13500,
    advancePaid: 4000,
    advancePaidDate: '2026-05-16',
    discount: 500,
    payments: [
      {
        id: '1',
        amount: 9000,
        date: '2026-05-17',
      },
    ],
    notes: '• Includes all meals and accommodations\n• Travel is inclusive of transportation\n• Please carry valid ID proof',
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
    if (!invoiceRef.current) return;

    try {
      // Build plain HTML content with only basic styles
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Georgia, serif; color: #000; background: #fff; padding: 32px; }
            h1 { font-size: 28px; font-weight: bold; margin: 0; }
            h3 { font-weight: bold; color: #000; margin: 0 0 8px 0; }
            p { margin: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            td { border: 1px solid #ccc; padding: 8px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px; }
            .subtitle { font-size: 16px; margin: 8px 0 0 0; }
            .section { margin-bottom: 24px; border-bottom: 1px solid #ccc; padding-bottom: 16px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; font-size: 14px; }
            .grid-right { text-align: right; }
            .label { color: #666; margin: 0; }
            .value { font-weight: bold; color: #000; margin: 0; }
            .bg-header { background-color: #f5f5f5; font-weight: bold; }
            .bg-total { background-color: #e6f2ff; }
            .text-red { color: #cc0000; font-weight: bold; }
            .text-blue { color: #0066cc; font-weight: bold; }
            .signature { text-align: right; margin-bottom: 32px; }
            .sig-line { margin: 0 0 32px 0; border-top: 1px solid #000; padding-top: 8px; display: inline-block; width: 150px; }
            .footer { text-align: center; font-weight: bold; color: #000; margin-top: 32px; }
            ul { margin: 0; padding-left: 20px; font-size: 13px; }
            li { margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display:flex; align-items:center; gap:24px; padding-bottom:16px; margin-bottom:24px;">
              <img src="/logo.png" alt="Logo"
                style="width:80px; height:80px; object-fit:contain; border-radius:8px; flex-shrink:0;"
                onerror="this.style.display='none'" />
              <div style="flex:1; text-align:center;">
                <h1 style="font-size:28px; font-weight:bold; letter-spacing:0.04em; margin:0;">ADN ADVENTURES</h1>
                <p style="font-size:18px; letter-spacing:0.06em; color:#555; margin:4px 0 0 0;">TOURS & TRAVELS</p>
                <p style="font-size:13px; color:#888; margin:6px 0 0 0;">Travel Invoice / Payment Receipt</p>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="grid">
              <div>
                <p class="label">Invoice No</p>
                <p class="value">${formData.invoiceNumber}</p>
              </div>
              <div class="grid-right">
                <p class="label">Invoice Date</p>
                <p class="value">${formatDate(formData.invoiceDate)}</p>
              </div>
            </div>
            <div class="grid">
              <div>
                <p class="label">Trip Destination</p>
                <p class="value">${formData.tripDestination}</p>
              </div>
              <div class="grid-right">
                <p class="label">Trip Status</p>
                <p class="value">${formData.tripStatus}</p>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Client Details</h3>
            <p style="font-size: 14px; color: #000; margin: 4px 0;"><span style="font-weight: bold;">Name:</span> ${formData.clientName}</p>
            <p style="font-size: 14px; color: #000; margin: 4px 0;"><span style="font-weight: bold;">Mobile:</span> ${formData.mobileNumber}</p>
            <p style="font-size: 14px; color: #000; margin: 4px 0;"><span style="font-weight: bold;">Address:</span> ${formData.address}</p>
          </div>

          <div class="section">
            <h3>Package Details</h3>
            <table>
              <tr>
                <td class="bg-header">Package Destination</td>
                <td>${formData.packageDestination}</td>
              </tr>
              <tr>
                <td class="bg-header">Package Date</td>
                <td>${formatDate(formData.packageStartDate)} to ${formatDate(formData.packageEndDate)}</td>
              </tr>
              <tr>
                <td class="bg-header">Number of Members</td>
                <td>${formData.numberOfMembers} Members</td>
              </tr>
              <tr>
                <td class="bg-header">Total Package Price</td>
                <td>₹${formData.totalPackagePrice.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="bg-header">Advance Paid</td>
                <td>₹${formData.advancePaid.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="bg-header">Advance Paid Date</td>
                <td>${formatDate(formData.advancePaidDate)}</td>
              </tr>
              ${formData.payments.map((payment, index) => `
                <tr>
                  <td class="bg-header">Payment ${index + 1}</td>
                  <td>₹${parseFloat(String(payment.amount)).toLocaleString()} (${formatDate(payment.date)})</td>
                </tr>
              `).join('')}
              <tr>
                <td class="bg-header">Discount</td>
                <td>₹${formData.discount.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="bg-header">Remaining Balance</td>
                <td class="text-red">₹${calculateBalance().toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <h3>Payment Summary</h3>
            <table>
              <tr>
                <td class="bg-header">Total Package Amount</td>
                <td style="text-align: right;">₹${formData.totalPackagePrice.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="bg-header">Discount Applied</td>
                <td style="text-align: right;">- ₹${formData.discount.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="bg-header">Advance Payment Received</td>
                <td style="text-align: right;">₹${formData.advancePaid.toLocaleString()}</td>
              </tr>
              ${formData.payments.map((payment, index) => `
                <tr>
                  <td class="bg-header">Payment ${index + 1} Received</td>
                  <td style="text-align: right;">₹${parseFloat(String(payment.amount)).toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr class="bg-total">
                <td style="font-weight: bold;">Total Amount Received</td>
                <td style="text-align: right;" class="text-blue">₹${calculateTotalReceived().toLocaleString()}</td>
              </tr>
            </table>
          </div>

          ${formData.notes ? `
            <div class="section">
              <h3>Notes</h3>
              <ul>
                ${formData.notes.split('\n').map(note => `<li>${note}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="signature">
            <p class="sig-line"></p>
            <p style="font-weight: bold; color: #000; margin-top: 8px;">Authorized Signature</p>
          </div>
          <p class="footer">Thank You & Have a Great Journey Ahead!</p>
        </body>
        </html>
      `;

      // Create an iframe to isolate rendering from page CSS
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      // Write HTML to iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Wait for iframe content to render
        await new Promise(resolve => setTimeout(resolve, 500));

        // Render iframe body to canvas
        const canvas = await html2canvas(iframeDoc.body, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          foreignObjectRendering: false,
        });

        // Clean up
        document.body.removeChild(iframe);

        // Generate PDF from canvas
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight > 297 * 10) {
          // Handle multi-page PDFs
          let heightLeft = imgHeight;
          let position = 0;

          while (heightLeft >= 0) {
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= 297;
            position -= 297;

            if (heightLeft > 0) {
              pdf.addPage();
            }
          }
        } else {
          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        }

        pdf.save(`Invoice-${formData.invoiceNumber}.pdf`);

        // Log to Google Sheets
        try {
          await fetch('https://script.google.com/macros/s/AKfycbzZNxHXUwS3WcU-TSDBNYZMUpuUa8S2qXUs5Dle2ths9f68PrgMLpZF1-f7tpUSI00/exec', {
            method: 'POST',
            body: JSON.stringify({
              invoiceNumber: formData.invoiceNumber,
              clientName: formData.clientName,
              tripDestination: formData.tripDestination,
              totalPackagePrice: formData.totalPackagePrice,
              balance: calculateBalance(),
              tripStatus: formData.tripStatus,
              numberOfMembers: formData.numberOfMembers,
            }),
          });
        } catch (logError) {
          console.warn('Sheet logging failed (non-critical):', logError);
        }
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
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">Advance Paid:</span> ₹
                    {formData.advancePaid.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-600">
                    Date: {formatDate(formData.advancePaidDate)}
                  </p>
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
              <h2 className="text-xl font-bold text-slate-900 mb-4">Notes</h2>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={4}
              />
            </Card>

            <div className="flex gap-4">
              <Button
                onClick={() => setShowPreview(!showPreview)}
                className="flex-1 bg-slate-800 hover:bg-slate-900"
              >
                <Eye className="w-4 h-4 mr-2" />
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
              <Button
                onClick={downloadPDF}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* Invoice Preview */}
          {showPreview && (
            <div className="lg:sticky lg:top-8 lg:h-fit">
              <div
                ref={invoiceRef}
                className="invoice-container bg-white p-8 rounded-lg shadow-lg border border-slate-200 space-y-6"
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
                        src="/logo.png"
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

                {/* Notes */}
                {formData.notes && (
                  <div className="space-y-2 border-b border-slate-300 pb-4">
                    <h3 className="font-bold text-slate-900">Notes</h3>
                    <ul className="text-sm text-slate-700 space-y-1">
                      {formData.notes.split('\n').map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer */}
                <div className="space-y-6 pt-4">
                  <div className="text-right">
                    <p className="text-sm text-slate-600 mb-8">
                      ________________________
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      Authorized Signature
                    </p>
                  </div>
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
