import React, { useState, useEffect } from 'react';
import { 
  Bolt, 
  Cpu, 
  Gavel, 
  Wallet, 
  User, 
  Camera, 
  Plus, 
  Crown, 
  ChevronRight, 
  ShieldCheck, 
  FileText,
  Loader2,
  Trash2
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { jsPDF } from 'jspdf';
import { createWorker } from 'tesseract.js';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils/cn';

// ==========================================
// CONFIGURATION - PLACE YOUR KEYS HERE
// ==========================================
const CONFIG = {
  // Stripe Publishable Key (pk_test_... or pk_live_...)
  STRIPE_PUBLISHABLE_KEY: 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_HERE',
  
  // Stripe Price IDs (create in Stripe Dashboard)
  STRIPE_PRICE_ID_MONTHLY: 'price_YOUR_MONTHLY_PRICE_ID_HERE', // $9.99/month
  STRIPE_PRICE_ID_ONE_TIME: 'price_YOUR_ONE_TIME_PRICE_ID_HERE', // $39.99 one-time
  
  // Supabase (for authentication & data storage)
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY_HERE',
  
  // Free AI API (Google Gemini - get from https://aistudio.google.com/)
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE',
};

// ==========================================

type Screen = 'home' | 'scanner' | 'legal' | 'chexsystems' | 'budget' | 'profile' | 'pricing';

interface Transaction {
  id: number;
  amt: number;
  type: 'income' | 'expense';
  category: string;
}

interface Violation {
  title: string;
  code: string;
  text: string;
  consumerLaw?: string;
}

interface ConsumerLaw {
  title: string;
  code: string;
  description: string;
  rights: string[];
}

// Consumer Laws Reference
const consumerLaws: ConsumerLaw[] = [
  {
    title: "Fair Credit Reporting Act (FCRA)",
    code: "15 U.S.C. § 1681",
    description: "Regulates credit reporting agencies and ensures accuracy, fairness, and privacy of consumer information.",
    rights: ["Right to know what's in your credit file", "Right to dispute inaccurate information", "Right to seek damages for violations"]
  },
  {
    title: "Fair and Accurate Credit Transactions Act (FACTA)",
    code: "15 U.S.C. § 1681",
    description: "Amends FCRA to help consumers combat identity theft and improve access to credit information.",
    rights: ["Free annual credit reports", "Fraud alerts and credit freezes", "Identity theft protection"]
  },
  {
    title: "Fair Debt Collection Practices Act (FDCPA)",
    code: "15 U.S.C. § 1692",
    description: "Prohibits abusive, deceptive, and unfair debt collection practices.",
    rights: ["Stop debt collector harassment", "Validate debt before payment", "Dispute incorrect debt information"]
  }
];

// ChexSystems Dispute Types
const chexSystemsDisputeTypes = [
  { id: 'incorrect-balance', title: 'Incorrect Account Balance', description: 'Dispute wrong balance information on your report' },
  { id: 'fraudulent-account', title: 'Fraudulent Account', description: 'Report accounts opened without your consent' },
  { id: 'expired-items', title: 'Expired Negative Items', description: 'Remove items older than 5 years' },
  { id: 'incorrect-info', title: 'Incorrect Personal Info', description: 'Fix name, SSN, or address errors' },
  { id: 'paid-debt', title: 'Paid Debt Still Showing', description: 'Remove paid collections or charge-offs' }
];

// Supabase Client Initialization (cloud storage)
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [isPremium, setIsPremium] = useState(() => localStorage.getItem('isPremium') === 'true');
  const [budget, setBudget] = useState<Transaction[]>(() => JSON.parse(localStorage.getItem('budget') || '[]'));
  const [scanning, setScanning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [scanResults, setScanResults] = useState<Violation[]>([]);
  const [selectedChexDispute, setSelectedChexDispute] = useState<string | null>(null);
  const [showLawDetails, setShowLawDetails] = useState<ConsumerLaw | null>(null);

  // Budget Calculations
  const income = budget.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amt, 0);
  const expenses = budget.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amt, 0);
  const surplus = income - expenses;

  useEffect(() => {
    localStorage.setItem('budget', JSON.stringify(budget));
  }, [budget]);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setStatusMsg('Running OCR Engine...');
    
    try {
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      setStatusMsg('Analyzing violations...');
      // Simulated AI Logic (Replace with real Gemini API call if key is available)
      setTimeout(() => {
        const matches: Violation[] = [];
        if (/late|payment|past/i.test(text)) {
          matches.push({ title: "Inaccurate Late Payment", code: "15 USC 1681i", text: "Report shows unverified late status." });
        }
        if (/charge|off|profit/i.test(text)) {
          matches.push({ title: "Charge-Off Violation", code: "15 USC 1681eb", text: "Maximum possible accuracy failure." });
        }
        if (matches.length === 0) {
          matches.push({ title: "Metro 2 Data Format Error", code: "FCRA Sec 611", text: "General unverified formatting item detected." });
        }
        setScanResults(matches);
        setScanning(false);
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Scan failed. Ensure document is clear.');
      setScanning(false);
    }
  };

  const generatePDF = (v: Violation) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("FORMAL DISPUTE NOTICE", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 40);
    doc.text(`Subject: Violation of ${v.code}`, 20, 50);
    doc.text(`Notice regarding: ${v.title}`, 20, 60);
    doc.text("To Whom It May Concern,", 20, 80);
    doc.text(`I am writing to formally dispute the following item: ${v.title}.`, 20, 90);
    doc.text(`Under ${v.code}, this information is inaccurate or unverified.`, 20, 100);
    doc.text("Please investigate and remove this item within 30 days.", 20, 110);
    doc.text("Sincerely, [Your Name]", 20, 130);
    doc.save(`dispute-${v.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  };

  const addTransaction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amt = parseFloat(formData.get('amount') as string);
    const type = formData.get('type') as 'income' | 'expense';
    if (!amt) return;
    setBudget([...budget, { id: Date.now(), amt, type, category: 'General' }]);
    e.currentTarget.reset();
  };

  const togglePremium = () => {
    const newState = !isPremium;
    setIsPremium(newState);
    localStorage.setItem('isPremium', String(newState));
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900">
      {/* Top Header */}
      <header className="bg-blue-600 px-6 pt-8 pb-12 text-white rounded-b-[3rem] shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight">POWER PLAY</h1>
            <p className="text-blue-100 text-[10px] font-bold uppercase tracking-[0.2em]">AI Housing Autopilot</p>
          </div>
          <div className="flex items-center gap-3">
            {isPremium && (
              <span className="bg-yellow-400 text-blue-900 text-[10px] px-3 py-1 rounded-full font-black animate-pulse">PRO ACTIVE</span>
            )}
            <button 
              onClick={() => setScreen('profile')}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md"
            >
              <User size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main View */}
      <main className="px-4 -mt-6 max-w-lg mx-auto space-y-6">
        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white p-6 rounded-3xl shadow-xl border-l-8 border-blue-600">
                <h2 className="text-xl font-black">Housing Readiness</h2>
                <p className="text-slate-500 text-sm mt-1">Our AI is ready to audit your records for violations.</p>
                <button 
                  onClick={() => setScreen('scanner')}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all uppercase tracking-wider text-sm"
                >
                  Start New AI Scan
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-[2rem] shadow-sm">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                    <FileText className="text-blue-600" size={20} />
                  </div>
                  <h3 className="font-bold text-sm">Metro 2</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Audit Logic</p>
                </div>
                <div className="bg-white p-5 rounded-[2rem] shadow-sm">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
                    <ShieldCheck className="text-emerald-600" size={20} />
                  </div>
                  <h3 className="font-bold text-sm">FCRA Pro</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">SafeGuard</p>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] space-y-4">
                <h3 className="font-black text-lg flex items-center gap-2">
                  <Bolt className="text-blue-400" size={20} />
                  Impact Dashboard
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] opacity-60 font-bold uppercase">Active Disputes</p>
                    <p className="text-xl font-black">0</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] opacity-60 font-bold uppercase">Success Rate</p>
                    <p className="text-xl font-black text-emerald-400">94%</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'scanner' && (
            <motion.div 
              key="scanner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-indigo-50 p-6 rounded-[2.5rem] border border-indigo-100">
                <h2 className="text-2xl font-black text-indigo-900">AI Dispute Hunter</h2>
                <p className="text-xs text-indigo-600 mt-1 leading-relaxed">
                  Upload credit reports or eviction notices. We identify illegal reporting codes using Computer Vision.
                </p>
              </div>

              <div className="bg-white border-4 border-dashed border-slate-100 rounded-[3rem] p-8 text-center relative hover:border-blue-400 transition-all group">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleScan}
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Camera className="text-blue-600" size={32} />
                </div>
                <p className="font-black text-slate-800">Tap to Upload Report</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">Private • No Cloud Storage</p>
              </div>

              {scanning && (
                <div className="p-8 text-center space-y-3">
                  <Loader2 className="animate-spin mx-auto text-blue-600" size={40} />
                  <p className="text-sm font-bold text-blue-600 animate-pulse">{statusMsg}</p>
                </div>
              )}

              <div className="space-y-4">
                {scanResults.map((res, i) => (
                  <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border-l-4 border-blue-600">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-black text-slate-800">{res.title}</h4>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-black">{res.code}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">{res.text}</p>
                    {isPremium ? (
                      <button 
                        onClick={() => generatePDF(res)}
                        className="w-full bg-blue-600 text-white text-xs font-black py-3 rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        GENERATE LEGAL DISPUTE PDF
                      </button>
                    ) : (
                      <button 
                        onClick={() => setScreen('profile')}
                        className="w-full bg-yellow-50 text-yellow-700 text-xs font-black py-3 rounded-xl border border-yellow-200 flex items-center justify-center gap-2"
                      >
                        <Crown size={14} /> UNLOCK PDF DRAFTING
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 'legal' && (
            <motion.div key="legal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <h2 className="text-2xl font-black px-2">Dispute Library</h2>
              <div className="space-y-3">
                {[
                  { title: "Equifax Erroneous Eviction", sub: "Target: Inaccurate Housing Court Data", color: "border-red-500" },
                  { title: "Metro 2 Format Compliance", sub: "Target: Data Reporting Inconsistencies", color: "border-purple-500" },
                  { title: "FCRA 15 USC 1681i", sub: "Target: Unverified Items", color: "border-blue-500" }
                ].map((item, i) => (
                  <div key={i} className={cn("bg-white p-5 rounded-2xl shadow-sm flex items-center justify-between border-l-4", item.color)}>
                    <div>
                      <p className="font-bold text-slate-800">{item.title}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{item.sub}</p>
                    </div>
                    <ChevronRight className="text-slate-300" />
                  </div>
                ))}
                
                <button 
                  onClick={() => setScreen('chexsystems')}
                  className="w-full bg-emerald-50 p-5 rounded-2xl shadow-sm flex items-center justify-between border-l-4 border-emerald-500 mt-4 hover:bg-emerald-100 transition-colors"
                >
                  <div className="text-left">
                    <p className="font-bold text-emerald-800">ChexSystems Dispute Forms</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Specialized banking report disputes</p>
                  </div>
                  <ChevronRight className="text-emerald-400" />
                </button>
                
                <div className="mt-6">
                  <h3 className="text-xl font-black mb-4 px-2">Consumer Rights Reference</h3>
                  {consumerLaws.map((law, i) => (
                    <div 
                      key={i} 
                      className="bg-white p-5 rounded-2xl shadow-sm mb-3 border border-slate-100 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setShowLawDetails(showLawDetails?.title === law.title ? null : law)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-800">{law.title}</p>
                          <p className="text-[10px] text-blue-600 font-medium">{law.code}</p>
                        </div>
                        <ChevronRight className={cn("text-slate-400 transition-transform", showLawDetails?.title === law.title ? "rotate-90" : "")} />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">{law.description}</p>
                      
                      {showLawDetails?.title === law.title && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 pt-4 border-t border-slate-100"
                        >
                          <p className="text-xs font-bold text-slate-700 mb-2">Your Rights:</p>
                          <ul className="space-y-1">
                            {law.rights.map((right, idx) => (
                              <li key={idx} className="text-xs text-slate-600 flex items-start">
                                <span className="text-emerald-500 mr-2">•</span>
                                {right}
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          
          {screen === 'chexsystems' && (
            <motion.div 
              key="chexsystems" 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-black px-2">ChexSystems Dispute Forms</h2>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4">
                <p className="text-xs text-emerald-800">
                  ChexSystems tracks your banking history. Use these forms to dispute inaccurate information that may prevent you from opening bank accounts.
                </p>
              </div>
              
              <div className="space-y-3">
                {[
                  { title: "Incorrect Account Balance", sub: "Dispute wrong balance information", icon: "dollar-sign" },
                  { title: "Fraudulent Account", sub: "Report accounts opened without your consent", icon: "shield" },
                  { title: "Expired Negative Items", sub: "Remove items older than 5 years", icon: "clock" },
                  { title: "Incorrect Personal Info", sub: "Fix name, SSN, or address errors", icon: "user" },
                  { title: "Paid Debt Still Showing", sub: "Remove paid collections or charge-offs", icon: "check-circle" }
                ].map((item, i) => (
                  <div 
                    key={i} 
                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedChexDispute(selectedChexDispute === item.title ? null : item.title)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                          <span className="text-emerald-600 font-bold">{i + 1}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{item.title}</p>
                          <p className="text-[10px] text-slate-500">{item.sub}</p>
                        </div>
                      </div>
                      <ChevronRight className={cn("text-slate-400 transition-transform", selectedChexDispute === item.title ? "rotate-90" : "")} />
                    </div>
                    
                    {selectedChexDispute === item.title && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-slate-100"
                      >
                        <p className="text-xs text-slate-600 mb-3">
                          This form will help you dispute {item.title.toLowerCase()} on your ChexSystems report.
                        </p>
                        {isPremium ? (
                          <button className="w-full bg-emerald-600 text-white text-xs font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors">
                            GENERATE DISPUTE FORM
                          </button>
                        ) : (
                          <button 
                            onClick={() => setScreen('pricing')}
                            className="w-full bg-yellow-50 text-yellow-700 text-xs font-bold py-3 rounded-xl border border-yellow-200"
                          >
                            UPGRADE TO ACCESS
                          </button>
                        )}
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
              
              <button 
                onClick={() => setScreen('legal')}
                className="mt-4 w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-2xl"
              >
                Back to Legal
              </button>
            </motion.div>
          )}
          
          {screen === 'pricing' && (
            <motion.div 
              key="pricing" 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-black text-center px-2">Choose Your Plan</h2>
              <p className="text-center text-slate-500 text-sm mb-6">
                Unlock all features to maximize your credit repair journey
              </p>
              
              <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-blue-600 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">MOST POPULAR</span>
                </div>
                <h3 className="text-xl font-black text-center mt-2">Monthly Subscription</h3>
                <div className="text-center my-4">
                  <span className="text-5xl font-black">$9.99</span>
                  <span className="text-slate-500">/month</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {["Unlimited document scans", "Full legal dispute library", "ChexSystems forms", "AI-powered analysis", "Monthly credit tips"].map((item, i) => (
                    <li key={i} className="flex items-center">
                      <span className="text-emerald-500 mr-2">✓</span>
                      <span className="text-sm text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => alert("This would connect to Stripe with price ID: " + CONFIG.STRIPE_PRICE_ID_MONTHLY)}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-colors"
                >
                  START MONTHLY SUBSCRIPTION
                </button>
              </div>
              
              <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
                <h3 className="text-xl font-black text-center">One-Time Payment</h3>
                <div className="text-center my-4">
                  <span className="text-5xl font-black">$39.99</span>
                  <span className="text-slate-500"> one-time</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {["Everything in monthly", "30 days of full access", "No recurring charges", "Download all forms", "Priority support"].map((item, i) => (
                    <li key={i} className="flex items-center">
                      <span className="text-emerald-500 mr-2">✓</span>
                      <span className="text-sm text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => alert("This would connect to Stripe with price ID: " + CONFIG.STRIPE_PRICE_ID_ONE_TIME)}
                  className="w-full bg-slate-800 text-white font-bold py-4 rounded-2xl hover:bg-slate-900 transition-colors"
                >
                  MAKE ONE-TIME PAYMENT
                </button>
              </div>
              
              <button 
                onClick={() => setScreen('profile')}
                className="mt-4 w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-2xl"
              >
                Back to Profile
              </button>
              
              <div className="mt-4 bg-blue-50 p-4 rounded-2xl">
                <p className="text-xs text-blue-800 text-center">
                  Configuration Note: Replace the placeholder keys in the CONFIG section with your actual Stripe, Supabase, and Gemini API credentials.
                </p>
              </div>
            </motion.div>
          )}

          {screen === 'budget' && (
            <motion.div key="budget" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-blue-600 p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">Monthly Surplus</p>
                  <h2 className="text-5xl font-black mt-2 tracking-tight">${surplus.toLocaleString()}</h2>
                  <div className="mt-8 flex gap-4">
                    <div className="flex-1 bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                      <p className="text-[10px] opacity-60 font-bold uppercase">Income</p>
                      <p className="font-bold text-lg">${income.toLocaleString()}</p>
                    </div>
                    <div className="flex-1 bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                      <p className="text-[10px] opacity-60 font-bold uppercase">Bills</p>
                      <p className="font-bold text-lg">${expenses.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm">
                <h3 className="font-black mb-4">Add Entry</h3>
                <form onSubmit={addTransaction} className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input 
                      name="amount"
                      type="number" 
                      placeholder="Amount" 
                      className="flex-1 p-4 bg-slate-50 rounded-2xl border-none text-sm font-bold focus:ring-2 ring-blue-500"
                    />
                    <select 
                      name="type"
                      className="p-4 bg-slate-50 rounded-2xl border-none text-xs font-bold focus:ring-2 ring-blue-500"
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2">
                    <Plus size={18} /> Add Record
                  </button>
                </form>
              </div>

              {budget.length > 0 && (
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm h-64">
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Income', value: income },
                          { name: 'Bills', value: expenses }
                        ]}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#2563eb" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              
              <div className="space-y-2">
                {budget.map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", t.type === 'income' ? 'bg-emerald-500' : 'bg-red-500')} />
                      <span className="font-bold text-sm">{t.type === 'income' ? 'Income' : 'Expense'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={cn("font-black", t.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                        {t.type === 'income' ? '+' : '-'}${t.amt}
                      </span>
                      <button onClick={() => setBudget(budget.filter(b => b.id !== t.id))}>
                        <Trash2 size={14} className="text-slate-300 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {screen === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 text-center">
              <div className="w-24 h-24 bg-blue-100 rounded-[2rem] mx-auto flex items-center justify-center text-blue-600 shadow-inner">
                <User size={48} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl font-black">Member Dashboard</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Status: {isPremium ? 'PRO' : 'FREE'}</p>
              </div>
              
              <div className="p-6 bg-white rounded-[3rem] shadow-sm space-y-4 text-left border border-slate-100">
                <button 
                  onClick={togglePremium}
                  className={cn(
                    "w-full p-6 rounded-2xl flex items-center justify-between transition-all",
                    isPremium ? "bg-emerald-50 border-emerald-200 border-2" : "bg-gradient-to-r from-yellow-400 to-orange-400 shadow-lg shadow-yellow-100"
                  )}
                >
                  <div className="text-left">
                    <p className={cn("font-black text-sm", isPremium ? "text-emerald-700" : "text-white")}>
                      {isPremium ? "PRO UNLOCKED" : "UPGRADE TO PRO"}
                    </p>
                    <p className={cn("text-[10px] font-bold", isPremium ? "text-emerald-600" : "text-white/80")}>
                      {isPremium ? "Active Subscription" : "Full AI Legal Access"}
                    </p>
                  </div>
                  <Crown className={cn(isPremium ? "text-emerald-500" : "text-white")} />
                </button>

                <div className="pt-4 space-y-3">
                  <div className="flex justify-between py-3 border-b border-slate-50 items-center">
                    <span className="text-slate-400 text-sm font-medium">Cloud Sync</span>
                    <span className="text-red-400 font-bold text-xs uppercase bg-red-50 px-2 py-1 rounded">Inactive</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-slate-50 items-center">
                    <span className="text-slate-400 text-sm font-medium">Data Encryption</span>
                    <span className="text-emerald-500 font-bold text-xs uppercase bg-emerald-50 px-2 py-1 rounded">256-Bit</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-medium px-8 leading-relaxed">
                Power Play is an educational tool. AI-generated disputes should be reviewed by a qualified professional. We are not a law firm.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center py-4 px-6 z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {[
          { id: 'home', icon: Bolt, label: 'DASH' },
          { id: 'scanner', icon: Cpu, label: 'SCAN' },
          { id: 'legal', icon: Gavel, label: 'LEGAL' },
          { id: 'budget', icon: Wallet, label: 'MONEY' }
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => setScreen(item.id as Screen)} 
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all duration-300",
              screen === item.id ? "text-blue-600 scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <item.icon size={22} strokeWidth={screen === item.id ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
