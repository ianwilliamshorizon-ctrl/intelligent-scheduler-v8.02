# Standard Operating Procedure: First-Time User Orientation & System Guide

**Objective:** To provide new staff members with a clear, end-to-end orientation of the Intelligent Scheduler platform upon their first login. This SOP details system navigation, core data models (Customer and Vehicle), the real-time Remote Help feature, multi-bay Gantt resource planning, inquiry handling, fast quotes, service packages, and extended commercial modules (Car Sales, Rentals, and Storage).

---

## 1. First-Time Login & System Orientation

### 1.1 Initial Login
1. **Accessing the Portal:** Open your modern web browser (Google Chrome, Microsoft Edge, or Safari recommended) and navigate to the Intelligent Scheduler application URL.
2. **Authentication:** Enter your assigned username/email and temporary password provided by your workshop administrator.
3. **Session Security:** 
   * Sessions automatically log out after 30 minutes of inactivity to protect customer data and GDPR compliance.
   * If accessing from a shared workshop terminal or tablet, remember to log out using the **Log Out** icon in the top-right header when your shift concludes.

### 1.2 Layout & Screen Anatomy
Upon logging in, the desktop interface is divided into three primary zones:
* **Left Sidebar (Navigation Menu):** Contains primary operational modules (Dashboard, Summary, Dispatch, Workflow, Service Stream, Jobs, Estimates, Invoices, Purchase Orders, Financial Reporting, Car Sales, Vehicle Storage, Rentals, Comms, Inquiries, Absence).
  * On larger screens, the sidebar can be toggled between expanded (icon + labels) and compact (icons only) by clicking the hamburger menu icon (`☰`).
  * On mobile tablets or smartphones, tap the menu button in the top header to slide the drawer into view.
* **Top Header Bar:** 
  * **Business Entity Selector (Workshop Branch):** Allows multi-site operations to toggle between locations (e.g., Brookspeed Southampton, Specialist Workshops, Storage Facility). Ensure you have selected the correct workshop entity before creating bookings or job cards.
  * **Global Search (`Ctrl+K` / Search Input):** Instantly search across customers (by name/phone), vehicles (by registration VRM/make/model), and parts (by part number/description).
  * **Master Tech AI Assistant (Sparkles Icon):** Quick-launch Google Gemini-powered diagnostic and scheduling advisor.
  * **Bay / Mobile Mode Toggle (Smartphone Icon):** Toggles between standard desktop management mode and high-contrast, touch-optimized workshop tablet mode.
  * **App Spacing Toggle:** Switches between compact layout and enhanced vertical screen padding.
  * **Visual Help Centre (Question Mark Icon):** Opens the interactive Visual Help Studio and SOP Library.
  * **User Profile & Role Badge:** Displays the logged-in user name and role privileges (e.g., Admin, Dispatcher, Engineer, Sales, Concierge).
* **Main Working Canvas:** Displays the active module view (e.g., live multi-bay Gantt board, Kanban lane cards, or estimate generator).

---

## 2. Navigating the System

Each view is designed for a specific stage of workshop and dealership management:

| View Name | Primary Function | Ideal For |
| :--- | :--- | :--- |
| **Dashboard** | High-level overview of daily job throughput, active vehicle check-ins, technician status, and recent bookings. | Reception, Service Advisors |
| **Summary / Directors** | Executive KPI telemetry, monthly billable hours, parts margins, and Gemini AI operational insights. | Workshop Directors, Owners |
| **Dispatch (Gantt Matrix)** | Multi-bay visual Gantt planner, drag-and-drop allocations, FCS auto-scheduler, and technician skill leveling. | Workshop Dispatchers, Service Managers |
| **Workflow (Kanban)** | Visual stage columns (Booked In, In Progress, Awaiting Parts, QC Inspection, Ready for Collection). | Bay Controllers, Workshop Floor |
| **Service Stream (Concierge)** | Real-time vehicle check-in walkthrough, defect logging, lift findings, and live customer handover stream. | Front-of-House Concierge |
| **Jobs** | Master register of all repair, MOT, and servicing job cards with detailed labor segment tracking. | Technicians, Workshop Foremen |
| **Estimates** | Customer quotation builder with live inventory lookup, labor packages, markup calculations, and digital approval tracking. | Service Advisors |
| **Invoices** | Statutory billing engine with HMRC 20% VAT calculations, split tender payments, and PDF generation. | Accounts, Administration |
| **Purchase Orders** | Supplier stock requisitions, goods-in barcode receiving, and supplier parts reconciliation. | Parts Department, Stores |
| **Financial Reporting** | Aged debtors ledger, sales revenue breakdown, and baseline profitability accounting. | Financial Controllers |
| **Inquiries** | Centralized communication inbox for inbound customer leads, web requests, and quotation follow-ups. | Sales & Service Front Desk |
| **Absence** | Technician holiday requests, compulsory leave, and UK bank holiday calendar sync. | HR, Resource Planners |

---

## 3. Remote Help Feature (Live Co-Browsing)

Intelligent Scheduler features a **Live Remote Assistance & Co-Browsing Engine** designed to provide instant, real-time guidance to new or struggling users without needing third-party software like TeamViewer or AnyDesk.

### 3.1 Requesting Remote Help
1. **Locate the Floating Help Button:** In the bottom-right corner of your screen, standard users will see a persistent purple pill button labeled **"Request Remote Help"** (`?`).
2. **Initiate the Request:** Click the button. The status changes to **"Connecting..."** and broadcasts an immediate alert to all active workshop managers and system administrators.
3. **Session Activation:** Once an administrator accepts your request, your session transitions into an active co-browsing connection:
   * **Ghost Pointer:** You will see the administrator's mouse cursor moving in real time across your screen, with their name tag attached.
   * **Synchronized Scrolling & Guidance:** As the administrator navigates or scrolls to explain a feature, your screen follows seamlessly.

### 3.2 User Privacy & Control Toggle
* **Interactive Control vs. Pointer Only:** In your active session banner, you have full control over permissions. You can toggle the **"Admin Control"** switch:
  * **Enabled (Default):** The administrator can click buttons, select dropdowns, and demonstrate workflows directly on your screen.
  * **Disabled (View Only):** The administrator is restricted to observation and pointing; they cannot click or submit any data on your behalf.
* **Integrated Live Chat:** Click the **Chat** button on the session banner to open the floating, draggable live chat panel. Exchange text messages with the assisting administrator in real time.
* **Ending the Session:** Click **"End Session"** (Red Power icon) at any time to instantly terminate the remote connection.

---

## 4. Fundamental Concepts: Customer vs. Vehicle

A common pitfall for first-time users is confusing customer records with vehicle records. Intelligent Scheduler operates on a **Relational Hierarchy**:

```
[CUSTOMER / ACCOUNT] 
       │
       ├── (1-to-Many Ownership)
       │
       ├──► [VEHICLE 1: VR19 XYZ (Porsche 911)] ──► [Estimates, Jobs, Invoices, MOTs]
       └──► [VEHICLE 2: LD21 ABC (BMW M3)]      ──► [Estimates, Jobs, Invoices, MOTs]
```

### 4.1 The Customer Record
* Represents the **legal owner, billing contact, or fleet entity**.
* Key data attributes: Forename, Surname, Company Name (for trade or fleet accounts), Billing Address, Postcode, Telephone, Mobile, Email.
* Communication preferences: SMS, Email, WhatsApp, and statutory GDPR marketing/service reminder consents.
* **Rule:** A single customer can own multiple vehicles (e.g., a family with 3 cars, or a commercial fleet with 20 vans).

### 4.2 The Vehicle Record
* Represents the **physical automotive asset** that enters the workshop bays.
* Key data attributes: Registration Mark (VRM), Make, Model, VIN (17 digits), Engine CC, Fuel Type, Color, Transmission, Manufacture Year.
* Live Telemetry & Statutory Data:
  * Automated **DVLA / MOT History Integration** (tests passed, advisories, retests, expiry dates).
  * Road Tax due dates and statutory SORN status.
  * Key tag assignments, digital tyre tread readings (OSF, NSF, OSR, NSR), walkaround damage diagrams, and service history.
* **Rule:** Estimates, Job Cards, and Invoices are always anchored to the **Vehicle**, which links back to the responsible **Customer**. This ensures that even if a vehicle changes ownership, its complete repair and maintenance history remains intact.

### 4.3 Creating Records On-The-Fly
* You do not need to create a customer or vehicle in isolation before starting work.
* When creating an **Inquiry**, **Estimate**, or **Job Card**, simply type the vehicle registration plate. If the vehicle is already known, the system auto-fills the customer details. If it is new, click **"Add New Vehicle"** or **"Add New Customer"** right inside the modal without losing your workflow context.

---

## 5. Gantt Resource Planning & Multi-Bay Scheduling

The **Dispatch Matrix** is the operational heartbeat of the workshop. It coordinates technicians, physical workshop bays, and repair timelines.

### 5.1 Understanding the Gantt Grid
* **Y-Axis (Rows):** Physical workshop bays (e.g., Bay 1 - 2-Post Lift, Bay 2 - Wheel Alignment, Bay 3 - Diagnostic Bay, MOT Lane).
* **X-Axis (Columns):** Time blocks across working hours (e.g., 08:00 to 17:30, divided into 30-minute intervals).
* **Technician Allocation Bar:** Shows assigned technicians, their shift hours, and scheduled breaks.

### 5.2 Key Scheduling Features
1. **Drag-and-Drop Job Allocations:** Drag job segments from the **Unallocated Repair Queue** directly into an open bay slot on the Gantt canvas.
2. **FCS Dynamic Auto-Scheduler:** Click **"Auto-Schedule with FCS"** to allow the algorithmic engine to automatically allocate pending jobs based on:
   * **Technician Skill Matrix:** Certified Master Techs receive complex engine diagnostics; general technicians receive routine service packages.
   * **Bay Capabilities:** Jobs requiring four-post wheel alignment lifts are matched only to certified bays.
   * **Capacity Leveling:** Balances work evenly to prevent bottlenecking one technician while another sits idle.
3. **Absence & Bank Holiday Awareness:** The Gantt board automatically cross-checks the **Absence Calendar** and UK Statutory Bank Holidays, blocking out slots when an engineer is on annual leave or training.
4. **Conflict Detection:** If an overlapping slot or unfeasible duration is scheduled, the system flags a visual red highlight warning.

---

## 6. Inquiry Management & Fast Quoting

Customer leads arrive constantly via website forms, telephone calls, and walk-ins. The **Inquiries** module ensures zero lost opportunities.

### 6.1 Inbound Inquiry Lifecycle
1. **Inbox & Triage:** Inbound messages enter the **Inbox** with caller details, vehicle registration, and requested work.
2. **Action Stages:** Track inquiry status through clear pipeline columns:
   * `Inbox` ➔ `New Requests` ➔ `Our Action` ➔ `Waiting on Customer` ➔ `Online Approved` ➔ `Scheduled` ➔ `Closed`.
3. **Fast Quote Conversion:** Click **"Convert to Estimate"** directly from an inquiry card. The system pulls the vehicle VRM, customer contact data, and inquiry notes into a fresh estimate draft within two seconds.
4. **Digital Quote Transmission:** Transmit the itemized estimate to the client via SMS or email with an integrated digital approval button.
5. **Instant Scheduling:** Once the client approves online, the inquiry card moves to **"Online Approved"**, ready for 1-click scheduling into the Gantt Dispatch matrix.

---

## 7. Service Package Concepts

To maximize estimating speed and workshop profitability, Intelligent Scheduler utilizes **Service Packages**.

### 7.1 What is a Service Package?
A Service Package is a pre-configured bundle combining:
* **Standard Labor Operations:** Pre-set manufacturer repair times (e.g., 1.5 hrs for Interim Service, 3.0 hrs for Major Service).
* **Standard Parts & Fluids:** OE oil filters, correct viscosity engine oil (e.g., 5W-30 Synthetic), sump plug washers, spark plugs, or pollen filters.
* **Calculated Pricing & VAT:** Fixed net price and statutory 20% VAT calculations, preventing calculation errors at front desk.

### 7.2 Why Use Packages Instead of Manual Line Items?
* **Sub-Minute Quotes:** Instead of manually searching for individual part numbers and typing hourly rates, select the package (e.g., *"Brookspeed 12-Month Major Service"*). All associated labor lines and parts auto-populate into the estimate instantly.
* **Consistent Margins:** Guarantees that parts markup and standard labor margins are maintained across all service advisors.
* **Automatic Stock Sync:** Attaching a service package immediately checks stock levels for the bundled oil and filters, alerting you if reorders are needed.

---

## 8. Extended Commercial Modules: Sales, Rentals & Storage

Beyond standard workshop servicing and MOTs, Intelligent Scheduler includes three integrated commercial suites:

### 8.1 Car Sales (Showroom & Vehicle Brokerage)
* **Stock & Inventory Management:** Maintain a digital showroom catalog of vehicles available for purchase, categorized by `Stock` or `Sale or Return (SOR)`.
* **Prep & Reconditioning Tracking:** Log internal workshop prep costs (e.g., pre-delivery inspections, paint touch-ups, wheel refurbishments) directly against the vehicle stock record, calculating true net gross profit margins.
* **Prospects Pipeline:** Track prospective buyers, scoring leads by urgency, desired make/model, and follow-up reminders.
* **Sales Invoicing:** Generate professional sales invoices with deposit tracking, part-exchange deductions, and warranty packages.

### 8.2 Vehicle Rentals & Hire
* **Rental Fleet Management:** Manage dedicated hire cars, courtesy loaner vehicles, and executive fleet units.
* **Booking Calendar:** Visual timeline displaying active hires, reservation dates, and return times.
* **Hire Agreements & Inspections:** Record collection and return mileage, fuel levels, deposit bonds, and walkaround inspection sign-offs.

### 8.3 Vehicle Storage
* **Secure Storage Bays:** Manage long-term, prestige, and classic vehicle storage across designated warehouse bays and locations.
* **Battery Conditioner & Charger Tracking:** Monitor vehicle trickle-charger connections (e.g., CTEK / smart chargers), logging battery health and charging history.
* **Routine Maintenance Cycles:** Schedule recurring periodic inspections (e.g., monthly tyre rotation, engine run-up to temperature, fluid checks).
* **Automated Recurring Billing:** Generate monthly or quarterly storage fee invoices with automated nominal ledger allocation.

---

## 9. First-Day Checklist for New Users

1. [ ] Log in and verify your name and role badge in the top-right header.
2. [ ] Test the **Workshop Entity Selector** to verify which location you are working in.
3. [ ] Use **Global Search (`Ctrl+K`)** to find an existing test vehicle or customer.
4. [ ] Locate the **"Request Remote Help"** floating widget in the bottom-right corner.
5. [ ] Open the **Dispatch** tab to view the multi-bay Gantt planner.
6. [ ] Click the **Help Centre (`?`)** in the header to view interactive visual diagrams.
7. [ ] When finished, log out to maintain workshop data security.
