import { useState } from 'react'

// ── Tax logic ─────────────────────────────────────────────────────────────────

// India new-regime slabs 2024-25 (with 4% cess)
function indiaNewRegimeTax(income) {
  const slabs = [
    [300000, 0],
    [600000, 0.05],
    [900000, 0.10],
    [1200000, 0.15],
    [1500000, 0.20],
    [Infinity, 0.30],
  ]
  if (income <= 700000) return 0 // rebate u/s 87A
  let tax = 0, prev = 0
  for (const [limit, rate] of slabs) {
    if (income <= prev) break
    tax += Math.min(income - prev, limit - prev) * rate
    prev = limit
  }
  return tax * 1.04 // 4% cess
}

// India DTAA rates
const DTAA_FD = 0.15
const DTAA_DIV = 0.15
const STCG_RATE = 0.15
const LTCG_RATE = 0.10
const LTCG_EXEMPTION = 100000

// US federal 2024 brackets (single)
function usFederalTax(income) {
  const brackets = [
    [11600, 0.10],
    [47150 - 11600, 0.12],
    [100525 - 47150, 0.22],
    [191950 - 100525, 0.24],
    [243725 - 191950, 0.32],
    [609350 - 243725, 0.35],
    [Infinity, 0.37],
  ]
  if (income <= 0) return 0
  let tax = 0, rem = income
  for (const [width, rate] of brackets) {
    const chunk = Math.min(rem, width)
    tax += chunk * rate
    rem -= chunk
    if (rem <= 0) break
  }
  return tax
}

// UK income tax + NI 2024-25
function ukIncomeTax(income) {
  const PA = 12570
  if (income <= PA) return 0
  const taxable = income - PA
  let tax = 0
  if (taxable <= 37700) tax = taxable * 0.20
  else if (taxable <= 125140) tax = 37700 * 0.20 + (taxable - 37700) * 0.40
  else tax = 37700 * 0.20 + (125140 - 37700) * 0.40 + (taxable - 125140) * 0.45
  return tax
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtUSD = (n) => '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
const fmtGBP = (n) => '£' + Math.abs(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtINR = (n) => '₹' + fmt(Math.abs(n))

const InputRow = ({ label, value, onChange, prefix = '₹', note }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}
      {note && <span className="ml-1 text-xs text-gray-400 font-normal">{note}</span>}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(Math.max(0, Number(e.target.value)))}
        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 text-sm"
      />
    </div>
  </div>
)

const ResultRow = ({ label, value, sub, highlight }) => (
  <div className={`flex justify-between items-center py-2 ${highlight ? 'border-t-2 border-indigo-200 pt-3 mt-1' : 'border-t border-gray-100'}`}>
    <span className={`text-sm ${highlight ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</span>
    <span className={`text-sm font-semibold ${sub ? 'text-red-600' : highlight ? 'text-indigo-700 text-base' : 'text-gray-900'}`}>{value}</span>
  </div>
)

// ── US-NRI Tab ────────────────────────────────────────────────────────────────

function USTab() {
  const [indiaSalary, setIndiaSalary] = useState(0)
  const [rentalIncome, setRentalIncome] = useState(0)
  const [fdInterest, setFdInterest] = useState(0)
  const [dividends, setDividends] = useState(0)
  const [stcg, setStcg] = useState(0)
  const [ltcg, setLtcg] = useState(0)
  const [usSalary, setUsSalary] = useState(0)
  const [usdRate, setUsdRate] = useState(83)

  const totalIndiaIncome = indiaSalary + rentalIncome + fdInterest + dividends + stcg + ltcg

  // India tax
  const indiaTaxOnSalaryRental = indiaNewRegimeTax(indiaSalary + rentalIncome)
  const indiaTaxOnFD = fdInterest * DTAA_FD
  const indiaTaxOnDiv = dividends * DTAA_DIV
  const indiaTaxOnSTCG = stcg * STCG_RATE
  const ltcgTaxable = Math.max(0, ltcg - LTCG_EXEMPTION)
  const indiaTaxOnLTCG = ltcgTaxable * LTCG_RATE
  const totalIndiaTax = indiaTaxOnSalaryRental + indiaTaxOnFD + indiaTaxOnDiv + indiaTaxOnSTCG + indiaTaxOnLTCG

  // US tax
  const indiaTotalUSD = totalIndiaIncome / usdRate
  const usTotalIncome = usSalary + indiaTotalUSD
  const usTaxTotal = usFederalTax(usTotalIncome)
  const usTaxOnIndiaIncome = usTaxTotal * (indiaTotalUSD / Math.max(usTotalIncome, 1))
  const indiaTaxPaidUSD = totalIndiaTax / usdRate
  const ftcCredit = Math.min(indiaTaxPaidUSD, usTaxOnIndiaIncome)
  const usNetTaxOnIndia = Math.max(0, usTaxOnIndiaIncome - ftcCredit)
  const usTaxOnUSSalary = usFederalTax(usSalary)
  const totalUSTax = usTaxOnUSSalary + usNetTaxOnIndia

  const needFBAR = totalIndiaIncome / usdRate > 10000
  const needForm8938 = totalIndiaIncome / usdRate > 50000
  const hasCapGains = stcg > 0 || ltcg > 0
  const hasFDDiv = fdInterest > 0 || dividends > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-lg">🇮🇳</span> India Income (Annual)
        </h2>
        <InputRow label="India Salary / Business Income" value={indiaSalary} onChange={setIndiaSalary} />
        <InputRow label="Rental Income" value={rentalIncome} onChange={setRentalIncome} note="(30% std deduction applied by ITD)" />
        <InputRow label="NRO FD Interest" value={fdInterest} onChange={setFdInterest} note="(15% DTAA rate)" />
        <InputRow label="Dividends" value={dividends} onChange={setDividends} note="(15% DTAA rate)" />
        <InputRow label="Short-term Capital Gains" value={stcg} onChange={setStcg} note="(equity/MF)" />
        <InputRow label="Long-term Capital Gains" value={ltcg} onChange={setLtcg} note="(₹1L exempt)" />

        <h2 className="font-semibold text-gray-900 mt-6 mb-4 flex items-center gap-2">
          <span className="text-lg">🇺🇸</span> US Income
        </h2>
        <InputRow label="US Salary / W-2 Income" value={usSalary} onChange={setUsSalary} prefix="$" />
        <InputRow label="USD/INR Exchange Rate" value={usdRate} onChange={setUsdRate} prefix="₹" note="(per $1)" />
      </div>

      {/* Results */}
      <div className="space-y-4">
        {/* India tax */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">🇮🇳 India Tax Liability</h3>
          <ResultRow label="Tax on salary + rental" value={fmtINR(indiaTaxOnSalaryRental)} />
          {fdInterest > 0 && <ResultRow label={`FD Interest tax (${DTAA_FD*100}% DTAA)`} value={fmtINR(indiaTaxOnFD)} />}
          {dividends > 0 && <ResultRow label={`Dividend tax (${DTAA_DIV*100}% DTAA)`} value={fmtINR(indiaTaxOnDiv)} />}
          {stcg > 0 && <ResultRow label="STCG tax (15%)" value={fmtINR(indiaTaxOnSTCG)} />}
          {ltcg > 0 && <ResultRow label={`LTCG tax (10%, above ₹${fmt(LTCG_EXEMPTION)} exempt)`} value={fmtINR(indiaTaxOnLTCG)} />}
          <ResultRow label="Total India Tax" value={fmtINR(totalIndiaTax)} highlight />
          <ResultRow label={`= ${fmtUSD(totalIndiaTax / usdRate)} at ₹${usdRate}/$`} value="" />
        </div>

        {/* US tax */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">🇺🇸 US Federal Tax</h3>
          <ResultRow label="US income" value={fmtUSD(usSalary)} />
          <ResultRow label={`India income (converted @ ₹${usdRate})`} value={fmtUSD(indiaTotalUSD)} />
          <ResultRow label="US tax before FTC" value={fmtUSD(usTaxOnUSSalary + usTaxOnIndiaIncome)} />
          <ResultRow label={`Foreign Tax Credit (Form 1116)`} value={`– ${fmtUSD(ftcCredit)}`} sub />
          <ResultRow label="Net US Tax on India income" value={fmtUSD(usNetTaxOnIndia)} />
          <ResultRow label="US Tax on US salary" value={fmtUSD(usTaxOnUSSalary)} />
          <ResultRow label="Total US Federal Tax" value={fmtUSD(totalUSTax)} highlight />
        </div>

        {/* Filing checklist */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="font-semibold text-amber-900 mb-3">📋 Filing Requirements</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className={needFBAR ? 'text-red-500 font-bold' : 'text-gray-400'}>
                {needFBAR ? '⚠️' : '✅'}
              </span>
              <span className={needFBAR ? 'text-gray-900' : 'text-gray-400'}>
                <strong>FBAR (FinCEN 114)</strong> — required if India accounts exceeded $10,000 at any point
                {needFBAR && <span className="ml-1 text-red-600 font-semibold">Due!</span>}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={needForm8938 ? 'text-red-500 font-bold' : 'text-gray-400'}>
                {needForm8938 ? '⚠️' : '✅'}
              </span>
              <span className={needForm8938 ? 'text-gray-900' : 'text-gray-400'}>
                <strong>Form 8938 (FATCA)</strong> — required if foreign assets exceed $50,000
                {needForm8938 && <span className="ml-1 text-red-600 font-semibold">Due!</span>}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={hasFDDiv ? 'text-blue-600' : 'text-gray-400'}>ℹ️</span>
              <span className={hasFDDiv ? 'text-gray-900' : 'text-gray-400'}>
                <strong>Form 1116</strong> — claim Foreign Tax Credit for India taxes paid on FD / dividends
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={totalIndiaIncome > 0 ? 'text-blue-600' : 'text-gray-400'}>ℹ️</span>
              <span className={totalIndiaIncome > 0 ? 'text-gray-900' : 'text-gray-400'}>
                <strong>ITR-2</strong> — file in India; report foreign assets in Schedule FA
              </span>
            </li>
            {hasCapGains && (
              <li className="flex items-start gap-2">
                <span className="text-blue-600">ℹ️</span>
                <span className="text-gray-900">
                  <strong>Schedule D (US)</strong> — report India capital gains; STCG taxed as ordinary income in the US
                </span>
              </li>
            )}
          </ul>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-800">
          <strong>Disclaimer:</strong> Estimates only — for informational purposes. Tax laws change. Consult a CPA or tax attorney for your situation.
        </div>
      </div>
    </div>
  )
}

// ── UK-NRI Tab ────────────────────────────────────────────────────────────────

function UKTab() {
  const [indiaSalary, setIndiaSalary] = useState(0)
  const [rentalIncome, setRentalIncome] = useState(0)
  const [fdInterest, setFdInterest] = useState(0)
  const [dividends, setDividends] = useState(0)
  const [stcg, setStcg] = useState(0)
  const [ltcg, setLtcg] = useState(0)
  const [ukSalary, setUkSalary] = useState(0)
  const [gbpRate, setGbpRate] = useState(105)

  const totalIndiaIncome = indiaSalary + rentalIncome + fdInterest + dividends + stcg + ltcg

  // India tax
  const indiaTaxOnSalaryRental = indiaNewRegimeTax(indiaSalary + rentalIncome)
  const indiaTaxOnFD = fdInterest * DTAA_FD
  const indiaTaxOnDiv = dividends * DTAA_DIV
  const indiaTaxOnSTCG = stcg * STCG_RATE
  const ltcgTaxable = Math.max(0, ltcg - LTCG_EXEMPTION)
  const indiaTaxOnLTCG = ltcgTaxable * LTCG_RATE
  const totalIndiaTax = indiaTaxOnSalaryRental + indiaTaxOnFD + indiaTaxOnDiv + indiaTaxOnSTCG + indiaTaxOnLTCG

  // UK tax
  const indiaTotalGBP = totalIndiaIncome / gbpRate
  const ukTotalIncome = ukSalary + indiaTotalGBP
  const ukTaxTotal = ukIncomeTax(ukTotalIncome)
  const ukTaxOnIndiaShare = ukTaxTotal * (indiaTotalGBP / Math.max(ukTotalIncome, 1))
  const indiaTaxPaidGBP = totalIndiaTax / gbpRate
  const dtaaCredit = Math.min(indiaTaxPaidGBP, ukTaxOnIndiaShare)
  const ukNetTaxOnIndia = Math.max(0, ukTaxOnIndiaShare - dtaaCredit)
  const ukTaxOnUKSalary = ukIncomeTax(ukSalary)
  const totalUKTax = ukTaxOnUKSalary + ukNetTaxOnIndia

  const hasCapGains = stcg > 0 || ltcg > 0
  const hasFDDiv = fdInterest > 0 || dividends > 0
  const needsSA = totalIndiaIncome > 0 || ukSalary > 100000

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-lg">🇮🇳</span> India Income (Annual)
        </h2>
        <InputRow label="India Salary / Business Income" value={indiaSalary} onChange={setIndiaSalary} />
        <InputRow label="Rental Income" value={rentalIncome} onChange={setRentalIncome} note="(30% std deduction by ITD)" />
        <InputRow label="NRO FD Interest" value={fdInterest} onChange={setFdInterest} note="(15% DTAA rate)" />
        <InputRow label="Dividends" value={dividends} onChange={setDividends} note="(15% DTAA rate)" />
        <InputRow label="Short-term Capital Gains" value={stcg} onChange={setStcg} note="(equity/MF)" />
        <InputRow label="Long-term Capital Gains" value={ltcg} onChange={setLtcg} note="(₹1L exempt)" />

        <h2 className="font-semibold text-gray-900 mt-6 mb-4 flex items-center gap-2">
          <span className="text-lg">🇬🇧</span> UK Income
        </h2>
        <InputRow label="UK Salary / Employment Income" value={ukSalary} onChange={setUkSalary} prefix="£" />
        <InputRow label="GBP/INR Exchange Rate" value={gbpRate} onChange={setGbpRate} prefix="₹" note="(per £1)" />
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">🇮🇳 India Tax Liability</h3>
          <ResultRow label="Tax on salary + rental" value={fmtINR(indiaTaxOnSalaryRental)} />
          {fdInterest > 0 && <ResultRow label={`FD Interest (${DTAA_FD*100}% DTAA)`} value={fmtINR(indiaTaxOnFD)} />}
          {dividends > 0 && <ResultRow label={`Dividends (${DTAA_DIV*100}% DTAA)`} value={fmtINR(indiaTaxOnDiv)} />}
          {stcg > 0 && <ResultRow label="STCG (15%)" value={fmtINR(indiaTaxOnSTCG)} />}
          {ltcg > 0 && <ResultRow label="LTCG (10%)" value={fmtINR(indiaTaxOnLTCG)} />}
          <ResultRow label="Total India Tax" value={fmtINR(totalIndiaTax)} highlight />
          <ResultRow label={`= ${fmtGBP(totalIndiaTax / gbpRate)} at ₹${gbpRate}/£`} value="" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">🇬🇧 UK Tax (2024-25)</h3>
          <ResultRow label="UK income" value={fmtGBP(ukSalary)} />
          <ResultRow label={`India income (converted @ ₹${gbpRate})`} value={fmtGBP(indiaTotalGBP)} />
          <ResultRow label="UK tax before DTAA relief" value={fmtGBP(ukTaxOnUKSalary + ukTaxOnIndiaShare)} />
          <ResultRow label="DTAA credit (SA106 / Form 1116 equiv.)" value={`– ${fmtGBP(dtaaCredit)}`} sub />
          <ResultRow label="Net UK tax on India income" value={fmtGBP(ukNetTaxOnIndia)} />
          <ResultRow label="UK tax on UK salary" value={fmtGBP(ukTaxOnUKSalary)} />
          <ResultRow label="Total UK Tax" value={fmtGBP(totalUKTax)} highlight />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="font-semibold text-amber-900 mb-3">📋 Filing Requirements</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className={needsSA ? 'text-red-500' : 'text-gray-400'}>{needsSA ? '⚠️' : '✅'}</span>
              <span className={needsSA ? 'text-gray-900' : 'text-gray-400'}>
                <strong>Self Assessment (SA100)</strong> — required for foreign income
                {needsSA && <span className="ml-1 text-red-600 font-semibold">Due!</span>}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={hasFDDiv ? 'text-blue-600' : 'text-gray-400'}>ℹ️</span>
              <span className={hasFDDiv ? 'text-gray-900' : 'text-gray-400'}>
                <strong>SA106 (Foreign)</strong> — claim DTAA relief for India taxes on FD / dividends
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={hasCapGains ? 'text-blue-600' : 'text-gray-400'}>ℹ️</span>
              <span className={hasCapGains ? 'text-gray-900' : 'text-gray-400'}>
                <strong>SA108 (Capital Gains)</strong> — report India cap gains if above annual CGT exempt amount (£3,000)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={totalIndiaIncome > 0 ? 'text-blue-600' : 'text-gray-400'}>ℹ️</span>
              <span className={totalIndiaIncome > 0 ? 'text-gray-900' : 'text-gray-400'}>
                <strong>ITR-2</strong> — file in India; declare UK income in Schedule FSI
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-800">
          <strong>Disclaimer:</strong> Estimates only — for informational purposes. Tax laws change. Consult a chartered accountant for your situation.
        </div>
      </div>
    </div>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: 'Why is FD interest taxed at 15% and not 30%?',
    a: 'India has DTAA (Double Taxation Avoidance Agreements) with both the US and UK. Under these treaties, NRO FD interest and dividends are taxed at a reduced rate of 15% instead of the standard 30% TDS rate. You must provide a Tax Residency Certificate (TRC) to your bank to claim this rate.'
  },
  {
    q: 'Do I have to pay tax in both countries on the same income?',
    a: 'No — that\'s what DTAA prevents. You pay tax in India first, then claim a Foreign Tax Credit (FTC) against your US or UK liability. If India\'s rate is higher than the US/UK rate, you pay nothing extra abroad. If the US/UK rate is higher, you pay only the difference.'
  },
  {
    q: 'What is FBAR and who needs to file it?',
    a: 'FBAR (FinCEN 114) is a US requirement for citizens and residents who hold foreign bank accounts whose aggregate value exceeded $10,000 at any point in the year. It is separate from your tax return and filed with FinCEN, not the IRS. Penalties for non-filing can reach $10,000+ per violation.'
  },
  {
    q: 'Should I switch from old tax regime to new for my India income?',
    a: 'For most NRIs, the new regime is better because NRIs cannot claim HRA, LTA, 80C, or 80D deductions — the main benefits of the old regime. This calculator uses the new regime slabs. If you have significant 80C investments, run both scenarios with a CA.'
  },
  {
    q: 'When is the ITR-2 filing deadline for NRIs?',
    a: 'The standard deadline is July 31 of the assessment year (e.g., July 31, 2025 for FY 2024-25), extendable to December 31 with a belated return. If you have foreign assets (Schedule FA) and your India income exceeds the basic exemption, ITR-2 is mandatory — not optional.'
  },
  {
    q: 'Is LTCG on Indian stocks taxable in the US/UK?',
    a: 'Yes. In the US, Indian equity LTCG is treated as foreign-source income and taxed at US long-term capital gains rates (0%, 15%, or 20% depending on income). You claim FTC for the 10% paid in India. In the UK, Indian LTCG is subject to UK CGT rates after the £3,000 annual exempt amount.'
  },
]

function FAQ() {
  const [open, setOpen] = useState(null)
  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
      <div className="space-y-3">
        {faqs.map((f, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full text-left px-5 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900 text-sm">{f.q}</span>
              <span className="text-gray-400 ml-4 flex-shrink-0">{open === i ? '▲' : '▼'}</span>
            </button>
            {open === i && (
              <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('us')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav style={{background:'#1e293b',padding:'12px 20px',display:'flex',alignItems:'center',gap:16,borderBottom:'1px solid #334155',margin:'-0px'}}><span style={{color:'#fff',fontWeight:700,fontSize:16}}>⚡ Tabutility</span><a href="https://tabutility.com" style={{color:'#94a3b8',textDecoration:'none',fontSize:14}}>← All Tools</a></nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🌏 Free NRI Tax Calculator 2024-25
          </h1>
          <p className="text-gray-500 text-base max-w-2xl mx-auto">
            Calculate your India tax liability and claim DTAA relief in the US or UK.
            Covers NRO FD, dividends, rental income, capital gains, and salary.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit mx-auto">
          <button
            onClick={() => setTab('us')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'us' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🇺🇸 US-India
          </button>
          <button
            onClick={() => setTab('uk')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'uk' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🇬🇧 UK-India
          </button>
        </div>

        {tab === 'us' ? <USTab /> : <UKTab />}

        {/* CTA */}
        <div className="mt-10 bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl p-6 text-white text-center">
          <h3 className="text-lg font-bold mb-1">Need help filing your NRI returns?</h3>
          <p className="text-indigo-100 text-sm mb-4">
            Connect with a CPA or chartered accountant who specialises in US-India / UK-India dual taxation.
          </p>
          <a
            href="https://www.google.com/search?q=NRI+tax+consultant+US+India+DTAA"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-indigo-700 font-semibold px-6 py-2 rounded-lg text-sm hover:bg-indigo-50 transition-colors"
          >
            Find a specialist →
          </a>
        </div>

        {/* AdSense */}
        <div className="my-8 text-center min-h-[90px] bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-xs">
          Advertisement
        </div>

        {/* FAQ */}
        <FAQ />

        {/* Schema.org FAQ */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map(f => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a }
          }))
        })}} />
      </main>

      <footer className="text-center text-xs text-gray-400 py-8 mt-4 border-t border-gray-100">
        © 2024 Tabutility · For informational use only · Not legal or financial advice ·{' '}
        <a href="https://tabutility.com" className="underline hover:text-gray-600">All Tools</a>
      </footer>
    </div>
  )
}
