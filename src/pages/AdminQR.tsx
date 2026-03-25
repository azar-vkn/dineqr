import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Download, Link2 } from "lucide-react";

export default function AdminQR() {
  const [tableCount, setTableCount] = useState(10);
  
  // Dynamically use the current domain so QR codes work on any deployment
  const appUrl = window.location.origin;
  const baseUrl = `${appUrl}/table/`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-stone-200 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">QR Code Generator</h1>
            <p className="text-stone-500 mt-1">Generate and print QR codes for your restaurant tables.</p>
            <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg flex items-start gap-3">
              <div className="mt-0.5">⚠️</div>
              <div>
                <p className="font-semibold">Important:</p>
                <p>For customers to scan these QR codes, you must first <strong>Share</strong> this app using the Share button in the top right corner of AI Studio.</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="tables" className="text-sm font-medium text-stone-600">Total Tables:</label>
              <input 
                id="tables"
                type="number" 
                min="1" 
                max="100" 
                value={tableCount}
                onChange={(e) => setTableCount(Number(e.target.value) || 1)}
                className="w-20 px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-emerald-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-900 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print All
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-3 print:gap-8">
          {Array.from({ length: tableCount }).map((_, i) => {
            const tableNumber = i + 1;
            const url = `${baseUrl}${tableNumber}`;
            
            return (
              <div key={tableNumber} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-col items-center text-center space-y-4 print:shadow-none print:border-stone-300">
                <div className="w-full flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">DineQR</span>
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md">Table {tableNumber}</span>
                </div>
                
                <div className="bg-white p-2 rounded-xl border-2 border-stone-100">
                  <QRCodeSVG 
                    value={url} 
                    size={140}
                    level="H"
                    includeMargin={false}
                    fgColor="#1c1917" // stone-900
                  />
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-bold text-stone-800 text-lg">Scan to Order</h3>
                  <p className="text-xs text-stone-500 max-w-[140px] mx-auto">Point your phone camera here to view the menu</p>
                </div>
                
                <div className="pt-4 w-full border-t border-stone-100 flex justify-center print:hidden">
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-800 text-white font-medium rounded-xl hover:bg-emerald-900 transition-colors text-sm shadow-sm"
                  >
                    <Link2 className="w-4 h-4" />
                    Order
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-stone-300 { border-color: #d6d3d1 !important; }
          .print\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .print\\:gap-8 { gap: 2rem !important; }
        }
      `}</style>
    </div>
  );
}
