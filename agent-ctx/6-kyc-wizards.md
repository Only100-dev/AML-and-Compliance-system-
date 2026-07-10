---
Task ID: 6
Agent: Frontend Developer - KYC Wizards
Task: Build Corporate and Individual KYC Wizard components

Work Log:
- Created `/src/components/ic-os/kyc/CorporateKYCWizard.tsx` - comprehensive corporate KYC onboarding wizard
  - Header with "Corporate KYC Onboarding" title, CBUAE Notice 3551/2021 subtitle, CBUAE Compliant badge
  - 4 summary stat cards: Total Applications (slate), Pending Review (amber), High Risk (rose), Approved (emerald)
  - 3-tab interface: Applications, New Application, UBO Registry
  - Applications tab: desktop table with 8 columns (Legal Name, Trade License, Legal Form, UBO, PEP, Risk Score gauge, Risk Rating badge, Status badge), expandable rows with TRN/UBO count/PEP details/UBO list; mobile card layout with Collapsible
  - New Application tab: 4-section form (Company Info, UBO Identification with dynamic UBO list and ≥25% amber warning, PEP Screening with conditional textarea, Risk Assessment with slider 0-100 and auto-calculated rating)
  - Maker-Checker visual enforcement: amber-bordered card with Shield icon when HIGH risk, submit button changes label to "Submit for Maker-Checker Approval"
  - UBO Registry tab: read-only table of all UBOs across applications with PEP status badges
  - Mock data: 3 applications (Gulf Maritime Services LLC/MEDIUM/APPROVED, Al-Rashid Insurance PJSC/HIGH/PENDING_MAKER_CHECKER, TechConsult ME FZCO/LOW/DRAFT)
  - Search/filter functionality on Applications tab
  - Legal Form badges color-coded (LLC=blue, PJSC=purple, Free Zone=cyan, etc.)
  - Risk Rating badges: LOW=emerald, MEDIUM=amber, HIGH=rose with ShieldAlert icon
  - Status badges: DRAFT=slate, PENDING_MAKER_CHECKER=amber, APPROVED=emerald, REJECTED=rose
  - Responsive design: desktop table + mobile cards with Collapsible

- Created `/src/components/ic-os/kyc/IndividualKYCWizard.tsx` - comprehensive individual KYC onboarding wizard
  - Header with "Individual KYC Onboarding" title, CDD/EDD subtitle, CDD/EDD Compliant badge
  - 4 summary stat cards: Total Profiles (slate), Standard Risk (emerald), High Risk/PEP (rose), EDD Required (amber)
  - 3-tab interface: Profiles, New Profile, PEP Registry
  - Profiles tab: desktop table with 8 columns (Full Name, Emirates ID, Passport No, Nationality, PEP Status, Risk Rating, EDD, Status), expandable rows with PEP details (rose border) and EDD documentation (amber border); mobile card layout
  - New Profile tab: 3-section form (Personal Information with Emirates ID/Passport/Nationality, Risk Assessment with PEP toggle and conditional PEP declaration form + risk rating select, EDD Documentation with auto-triggered SoF/SoW/PoB textareas and Senior Mgmt Approval toggle)
  - PEP Status badges: PEP=rose with AlertTriangle, Clear=emerald with CheckCircle2
  - EDD auto-calculated: triggered when isPep=true OR riskRating=HIGH, shown with amber indicator
  - Maker-Checker notice: amber-bordered card for PEP/HIGH risk profiles
  - PEP Registry tab: filtered PEP-only view with summary cards (Total PEPs, Pending Approval, Approved), enhanced detail table with position/country/from date, EDD status badges, mobile cards with monitoring notes
  - Mock data: 4 profiles (Ahmed Al-Mansoori/STANDARD/APPROVED, Sarah Johnson/HIGH PEP/PENDING_MAKER_CHECKER, Mohammed Al-Fahim/STANDARD/APPROVED, Hassan Al-Rashidi/HIGH PEP/DRAFT)
  - Search/filter functionality on Profiles tab
  - Nationality dropdown with UAE + 22 common nationalities

- Updated Sidebar.tsx: Added Building2 and UserCircle icons, added kycItems array with Corporate KYC and Individual KYC entries, added "KYC Onboarding" section between Phase 3 and Tools
- Updated page.tsx: Added CorporateKYCWizard and IndividualKYCWizard imports, added 'corporate-kyc' and 'individual-kyc' routes to switch statement
- Ran `bun run lint` - zero errors

Stage Summary:
- Two comprehensive KYC wizard components created with full form workflows
- Corporate KYC: UBO identification, PEP screening, risk assessment with auto-calculated rating
- Individual KYC: CDD/EDD with PEP declaration, auto-triggered EDD documentation
- Maker-Checker visual enforcement with amber-bordered notices for HIGH risk
- Both components follow IC-OS visual language (dark mode, emerald/amber/rose color coding)
- Responsive design: desktop tables + mobile card layouts
- Integrated into sidebar navigation and page routing
- Zero lint errors
