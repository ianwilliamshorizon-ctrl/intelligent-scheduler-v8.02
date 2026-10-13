# Standard Operating Procedure: First-Time User Orientation & System Guide

**Objective:** To provide new staff members with a clear, end-to-end orientation of the Intelligent Scheduler platform upon their first login. This SOP details system navigation, core data models (Customer and Vehicle), the real-time Remote Help feature, multi-bay Gantt resource planning, inquiry handling, fast quotes, service packages, and extended commercial modules (Car Sales, Rentals, and Storage). Every major task is hyperlinked directly to practical examples and visual illustrations below.

---

## Quick Navigation & Illustration Index

* [1. First-Time Login & System Orientation](#1-first-time-login--system-orientation) ➔ [🔗 View Illustration 1: Header, Navigation & Remote Co-Browse](#illustration-1-login-screen-navigation-and-remote-co-browsing)
* [2. Navigating the System](#2-navigating-the-system) ➔ [🔗 View Module Navigation Table](#2-navigating-the-system)
* [3. Remote Help Feature (Live Co-Browsing)](#3-remote-help-feature-live-co-browsing) ➔ [🔗 View Illustration 1: Remote Help Ghost Cursor & Chat](#illustration-1-login-screen-navigation-and-remote-co-browsing)
* [4. Fundamental Concepts: Customer vs. Vehicle](#4-fundamental-concepts-customer-vs-vehicle) ➔ [🔗 View Illustration 2: 1-to-Many Customer-Vehicle Diagram](#illustration-2-customer-and-vehicle-relational-architecture)
* [5. Gantt Resource Planning & Multi-Bay Scheduling](#5-gantt-resource-planning--multi-bay-scheduling) ➔ [🔗 View Illustration 3: Multi-Bay Gantt Matrix Schematic](#illustration-3-multi-bay-gantt-resource-planning-and-fcs-matrix)
* [6. Inquiry Management & Fast Quoting](#6-inquiry-management--fast-quoting) ➔ [🔗 View Illustration 4: Inquiry-to-Estimate Pipeline](#illustration-4-inbound-inquiries-fast-quotes-and-service-packages)
* [7. Service Package Concepts](#7-service-package-concepts) ➔ [🔗 View Illustration 4: Bundled Service Package Breakdown](#illustration-4-inbound-inquiries-fast-quotes-and-service-packages)
* [8. Extended Commercial Modules: Sales, Rentals & Storage](#8-extended-commercial-modules-sales-rentals--storage) ➔ [🔗 View Illustration 5: Commercial 3-Hub Matrix](#illustration-5-extended-commercial-suites-car-sales-rentals-and-storage)
* [9. First-Day Checklist for New Users](#9-first-day-checklist-for-new-users)
* [10. Task-by-Task Illustrated Examples & Visual Schematics Library](#10-task-by-task-illustrated-examples--visual-schematics-library)

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

> 💡 **Task Example & Illustration**: [Click here to inspect Illustration 1: Header, Navigation & Remote Co-Browsing ➔](#illustration-1-login-screen-navigation-and-remote-co-browsing)

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

> 💡 **Task Example & Illustration**: [Click here to inspect Illustration 1: Remote Help Ghost Pointer & Co-Browse Workflow ➔](#illustration-1-login-screen-navigation-and-remote-co-browsing)

---

## 4. Fundamental Concepts: Customer vs. Vehicle

A common pitfall for first-time users is confusing customer records with vehicle records. Intelligent Scheduler operates on a **Relational Hierarchy**:

```
[CUSTOMER / ACCOUNT] (Legal Owner or Company)
       │
       ├── (1-to-Many Ownership Link)
       │
       ├──► [VEHICLE 1: VR19 XYZ (Porsche 911)] ──► [Estimates, Jobs, Invoices, MOTs]
       ├──► [VEHICLE 2: OU21 HJK (BMW M3)]      ──► [Estimates, Jobs, Invoices, MOTs]
       └──► [VEHICLE 3: WX68 BBN (Transit Van)] ──► [Estimates, Jobs, Invoices, MOTs]
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

> 💡 **Task Example & Illustration**: [Click here to inspect Illustration 2: Customer vs Vehicle 1-to-Many Architecture ➔](#illustration-2-customer-and-vehicle-relational-architecture)

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

> 💡 **Task Example & Illustration**: [Click here to inspect Illustration 3: Multi-Bay Gantt Matrix Schematic & Skill Allocation ➔](#illustration-3-multi-bay-gantt-resource-planning-and-fcs-matrix)

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

> 💡 **Task Example & Illustration**: [Click here to inspect Illustration 4: Inquiry-to-Estimate 35-Second Pipeline ➔](#illustration-4-inbound-inquiries-fast-quotes-and-service-packages)

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

> 💡 **Task Example & Illustration**: [Click here to inspect Illustration 4: Bundled Service Package Breakdown ➔](#illustration-4-inbound-inquiries-fast-quotes-and-service-packages)

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

> 💡 **Task Example & Illustration**: [Click here to inspect Illustration 5: Commercial 3-Hub Matrix ➔](#illustration-5-extended-commercial-suites-car-sales-rentals-and-storage)

---

## 9. First-Day Checklist for New Users

1. [ ] Log in and verify your name and role badge in the top-right header.
2. [ ] Test the **Workshop Entity Selector** to verify which location you are working in.
3. [ ] Use **Global Search (`Ctrl+K`)** to find an existing test vehicle or customer.
4. [ ] Locate the **"Request Remote Help"** floating widget in the bottom-right corner.
5. [ ] Open the **Dispatch** tab to view the multi-bay Gantt planner.
6. [ ] Click the **Help Centre (`?`)** in the header to view interactive visual diagrams.
7. [ ] When finished, log out to maintain workshop data security.

---

## 10. Task-by-Task Illustrated Examples & Visual Schematics Library

This section provides visual schematics and realistic operational scenarios for every primary workflow task.

---

### Illustration 1: Login Screen, Navigation and Remote Co-Browsing

```
+---------------------------------------------------------------------------------------------------------+
| [=] BROOKSPEED v8.02 | [Entity: Brookspeed Southampton HQ v] | [Search: Ctrl+K.....] | [AI*] [Mobile] [?] [User] |
+---------------------------------------------------------------------------------------------------------+
| [NAV MENU]  |                                                                                           |
|  Dashboard  |  ACTIVE WORKSHOP WORKING CANVAS                                                          |
|  Summary    |                                                                                           |
|* Dispatch   |                                                                                           |
|  Workflow   |                                                GHOST CURSOR GUIDANCE:                     |
|  Jobs       |                                                  /|                                       |
|  Estimates  |                                                 / |  [Dave M. (Workshop Manager)]        |
|  Invoices   |                                                +--+  "Click here to open Bay 1"           |
|  Sales      |                                                                                           |
|  Rentals    |                                                                                           |
|  Storage    |                                                               +-------------------------+ |
|  Inquiries  |                                                               | LIVE CO-BROWSE CHAT     | |
|             |                                                               | Dave: I will guide you. | |
|             |                                                               | Sarah: Thank you!       | |
|             |                                                               | [ Type message...   [>] | |
|             |                                                               +-------------------------+ |
|             |                                                [ ( ? ) Request Remote Help ] <--- WIDGET  |
+-------------+-------------------------------------------------------------------------------------------+
```

#### Realistic Scenario Data Sheet: Remote Co-Browsing
| Field / Component | Concrete Example Setting | Operational Meaning |
| :--- | :--- | :--- |
| **User Staff** | Sarah C. (Reception / Service Advisor) | First-time user logging in at reception desk. |
| **Branch Entity** | Brookspeed Southampton HQ | Selected workshop location for all active bookings. |
| **Remote Trigger** | Floating Purple Button `( ? )` | Positioned at bottom-right of viewport at all times. |
| **Assisting Admin** | Dave M. (Master Tech / Workshop Manager) | Receives instant desktop notification and clicks "Accept". |
| **Ghost Pointer** | Real-time synchronized SVG cursor | Shows Dave's cursor on Sarah's screen with name tag. |
| **Admin Control Switch** | Toggle: `Active` (Default) | Allows Dave to demonstrate clicks or switches to View-Only. |
| **Live Chat Drawer** | Draggable floating chat panel | Instant communication without leaving the active screen. |

---

### Illustration 2: Customer and Vehicle Relational Architecture

```
                    +----------------------------------------------+
                    |           CUSTOMER MASTER RECORD             |
                    |  ID: #CUST-1049                              |
                    |  Name: Mr. Arthur Pendelton                  |
                    |  Company: Horizon Logistics UK               |
                    |  Phone: 07700 900123 • Email: arthur@hz.co.uk|
                    |  Billing: 14 Southampton Way, SO15 1XX       |
                    +----------------------------------------------+
                                          │
                     ┌────────────────────┼────────────────────┐
                     ▼                    ▼                    ▼
        +─────────────────────+ +─────────────────────+ +─────────────────────+
        | VEHICLE 1: PRIVATE  | | VEHICLE 2: WEEKEND  | | VEHICLE 3: FLEET    |
        | Reg: VR19 XYZ       | | Reg: OU21 HJK       | | Reg: WX68 BBN       |
        | Porsche 911 GT3     | | BMW M3 Competition  | | Ford Transit Custom |
        | VIN: WP0ZZZ99ZKS... | | VIN: WBA8M920...    | | VIN: WF0YXXTTG...   |
        | Mileage: 42,150 mi  | | Mileage: 18,300 mi  | | Mileage: 94,800 mi  |
        | MOT: 14/11/2026     | | MOT: 02/08/2027     | | MOT: 19/01/2027     |
        +─────────────────────+ +─────────────────────+ +─────────────────────+
                     │                    │                    │
                     ▼                    ▼                    ▼
             [Service History]    [Warranty Audit]      [Quarterly Inspec]
             [#JOB-8842, #8890]   [#JOB-8120]           [#JOB-7940, #8012]
```

#### Key Rules to Remember:
1. **Never create a duplicate customer:** Always check the top search bar (`Ctrl+K`) for existing mobile numbers or surnames.
2. **Vehicles hold the history:** If Arthur sells `VR19 XYZ` to another client, reassign the vehicle owner; the complete MOT history, lift inspection photos, and repair receipts remain permanently linked to the vehicle registration.

---

### Illustration 3: Multi-Bay Gantt Resource Planning and FCS Matrix

```
TIME GRID:   [08:00]      [09:00]      [10:00]      [11:00]      [12:00]      [13:00]      [14:00]      [15:00]      [16:00]
══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BAY 1 (2-POST):
Dave M. (Master) ───► [ JOB #8842: Audi RS6 Brake & Hub ] ──────────► [ LUNCH ] ──► [ JOB #8851: Porsche Minor Service ]
                      (VR19 XYZ • Allocated 3.5h)                                    (WX20 ABC • Allocated 2.0h)
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
BAY 2 (4-POST ALIGN):
Chris T. (Senior) ──► [ JOB #8845: BMW M3 4-Wheel Geometry Alignment ] ──► [ LUNCH ] ──► [ JOB #8853: Suspension Overhaul ]
                      (OU21 HJK • Allocated 2.5h)                                        (LD22 FGH • Allocated 3.0h)
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
BAY 3 (FAST SERVICE):
Mark P. (Technician) ► [ JOB #8847: MOT & Interim Service ] ────────► [ LUNCH ] ──► [ JOB #8855: Brake Disc Replacement ]
                      (GF19 KLP • Allocated 2.0h)                                    (HN18 YZA • Allocated 1.5h)
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
BAY 4 (MOT LANE):
Tester Certified ───► [ MOT-101 ] ──► [ MOT-102 ] ──► [ MOT-103 ] ──► [ LUNCH ] ──► [ MOT-104 ] ──► [ MOT-105 ] ──► [ MOT-106 ]
                      (08:30)         (09:30)         (10:30)                        (13:30)         (14:30)         (15:30)
```

#### Operational Workflow:
* **Drag-and-Drop:** Pick up unallocated repair cards from the bottom queue and drop them into an open time window.
* **Auto-Scheduler (FCS):** Click **"Auto-Schedule with FCS"**; the engine checks technician skill badges (e.g., Master Tech certification for complex engine faults) and ensures no job is placed on an absent technician or UK bank holiday.

---

### Illustration 4: Inbound Inquiries, Fast Quotes and Service Packages

```
   [STEP 1: INBOUND LEAD]           [STEP 2: 1-CLICK QUOTE]             [STEP 3: BUNDLED PACKAGE]
   Customer calls or submits        Click "Convert to Estimate"         Select Service Package:
   web form for VR19 XYZ            on Inquiry #INQ-4921                "PKG-MAJ01: 24-Mo Major Service"
             │                                 │                                    │
             ▼                                 ▼                                    ▼
   +───────────────────────+        +───────────────────────+        +────────────────────────────+
   | INQUIRY #INQ-4921     |        | ESTIMATE #EST-3312    |        | PACKAGE AUTO-POPULATION:   |
   | From: Sarah Jenkins   |  ───►  | Customer: S. Jenkins  |  ───►  | • 2.5h Labor @ £85 = £212.50|
   | Vehicle: Ford Puma    |        | Vehicle: Ford Puma    |        | • OE Oil Filter    = £18.50|
   | Work: Major Service   |        | Status: Draft Quoted  |        | • 5W-30 Synt Oil   = £64.00|
   +───────────────────────+        +───────────────────────+        | • Spark Plugs (x4) = £48.00|
                                                                     | • Pollen Filter    = £24.00|
                                                                     | NET TOTAL:          £367.00|
                                                                     | VAT (20%):          £73.40 |
                                                                     | GROSS TOTAL:        £440.40|
                                                                     +────────────────────────────+
                                                                                    │
                                                                                    ▼
                                                                     [STEP 4: CUSTOMER SIGN-OFF]
                                                                     Transmitted via SMS link.
                                                                     Customer clicks "Approve".
                                                                     Estimate ➔ Active Job Card #JOB-8843!
```

---

### Illustration 5: Extended Commercial Suites (Car Sales, Rentals and Storage)

```
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    COMMERCIAL ENTERPRISE EXPANSION                                       |
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                   |                                                     |
|  🏎️ 1. CAR SALES & SHOWROOM                        |  🚙 2. VEHICLE RENTALS & COURTESY FLEET             |
|  ───────────────────────────                      |  ─────────────────────────────────────              |
|  • Stock Record: #CS-401 (Porsche 991 GT3 RS)     |  • Fleet Unit: #RENT-04 (VW Golf 2.0 TDI)           |
|  • Acquisition Type: Sale or Return (SOR)         |  • Booking Ref: #RB-2026-88                         |
|  • Purchase/Agreed Return: £112,000.00            |  • Hire Duration: 2 Days (Workshop Courtesy)        |
|  • Workshop Prep Costs: £850.00 (Lift QC pass)    |  • Departure Checks: Fuel 8/8, 31,450 mi            |
|  • Retail List Price: £124,950.00                 |  • Damage Log: Zero walkaround defects noted        |
|  • Gross Profit Margin: £12,100.00                |  • Agreement: Digital touchscreen signature         |
|  • Active Prospects: 4 Buyers Qualified           |  • Return Status: Check-In verified, deposit cleared|
|                                                   |                                                     |
|───────────────────────────────────────────────────┴─────────────────────────────────────────────────────|
|                                                                                                         |
|  🔒 3. VEHICLE STORAGE & BATTERY CONDITIONING                                                           |
|  ────────────────────────────────────────────                                                           |
|  • Storage Facility: Brookspeed Secure Warehouse North (Dehumidified)                                   |
|  • Assigned Bay: Storage Bay #ST-12 (Prestige Enclosure)                                                |
|  • Stored Asset: 1968 Ferrari 246 Dino (Chassis #00214)                                                 |
|  • Battery Conditioner: CTEK Smart Multi-Charger #04 (Connected • 13.6V Floating Float Cycle)           |
|  • Maintenance Cycle: 30-Day Engine Warm-Up & Tyre Rotation (Scheduled 25th of month)                  |
|  • Billing Plan: £75.00 + VAT weekly recurring charge (Linked to Automated Monthly Invoices)           |
|                                                                                                         |
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

#### How the Modules Cross-Connect:
* **Car Sales prep work** directly generates internal workshop job cards with real technician labor hours.
* **Rentals courtesy bookings** link directly to active workshop repair cards when customers leave their vehicle for service.
* **Vehicle Storage billing** feeds directly into the master VAT Invoice ledger and aged debtors reporting.
