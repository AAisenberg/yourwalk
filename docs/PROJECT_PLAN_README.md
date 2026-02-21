# YourWalk Project Plan for Grant and Collaborators

This folder contains a **grant-aligned project plan** for the City of Casey Connecting Grant (CCLL00012) that you can use in your shared Google Drive with the Monash XYX Lab collaborator.

## What’s here

| File | Purpose |
|------|--------|
| **PROJECT_PLAN_CCLL.csv** | Task list aligned to the grant’s 5 phases. Import into Google Sheets for a shared project tracker. |
| **PROJECT_PLAN_SUMMARY.csv** | One-page phase summary (deliverables and who does what). Import as a second sheet for quick reference. |
| **PROJECT_PLAN_README.md** | This file: how to use the plan and how it maps to the application. |

## How to use in Google Sheets (shared with Monash XYX Lab)

1. **Open Google Drive** (your shared folder with the collaborator).
2. **Create a new Google Sheet** (e.g. “YourWalk – CCLL Project Plan”).
3. **Import the CSV**  
   - **File → Import → Upload** (or drag `PROJECT_PLAN_CCLL.csv`).  
   - Choose **Replace spreadsheet** or **Insert new sheet(s)**.  
   - Set separator to **Comma**.  
   - Click **Import data**.
4. **Optional improvements**  
   - Freeze the header row (View → Freeze → 1 row).  
   - Add a **Date_start** and **Date_end** column and fill from your actual project start (grant says 12–14 months, start within 1 month of approval).  
   - Add **Assignee** or **Lead** if you want names.  
   - Use **Status** (e.g. Not started / In progress / Done) and update as you go.  
   - Use **Data → Create a filter** so Monash and CrowdLab can filter by Phase, Owner, Workstream.
5. **Timeline (Gantt)**: The CSV includes **Start_date** and **End_date** columns (placeholder dates for a 12–14 month run from Nov 2025). Adjust them to your actual project start. To build a Gantt in Sheets: select columns **Task**, **Start_date**, **End_date** (and optionally **Phase**), then **Insert → Chart**. Choose a **Stacked bar chart**; set **Start_date** as the first series and **(End_date − Start_date)** as the second (you may need a helper column for duration in days). Alternatively use a Gantt template from Google’s template gallery or an add-on.
6. **Optional – Phase summary**: Create a second sheet in the same workbook and import **PROJECT_PLAN_SUMMARY.csv** for a one-page overview (deliverables and Monash vs CrowdLab vs Council focus). Useful for meetings and reports.
7. **Share the sheet** with the XYX Lab collaborator (e.g. Nicole Kalms / project lead) with **Editor** or **Commenter** as needed.

## How the plan maps to the grant application

The plan is structured to match the **scope and milestones** in the application.

| Application phase | Plan phases (in CSV) | Main owner |
|-------------------|----------------------|------------|
| **Inception** – Project setup and engagement plan | Inception (Pre-Q1) | Monash + CrowdLab |
| **Q1** – Initiation and co-design | Q1 Initiation and co-design | Monash (lead engagement); CrowdLab (data) |
| **Q2** – Data integration and vulnerability analysis | Q2 Data integration and vulnerability analysis | CrowdLab (lead technical); Monash (report) |
| **Q3** – Tool and dashboard development | Q3 Tool and dashboard development | CrowdLab (lead build); Mid-project review: all |
| **Q4** – Pilot testing and evaluation | Q4 Pilot testing and evaluation | Monash (lead evaluation); CrowdLab (refinements) |
| **Q4–Q5** – Reporting and dissemination | Q4–Q5 Reporting and dissemination | Monash (lead reporting and open access) |

**Grant deliverables** are included as rows in the CSV:

- **Inception**: Stakeholder onboarding, site selection, ethics clearance, pilot planning, community engagement plan, co-design workshop schedule.
- **Q2**: Peer-reviewed report “YourWalk: AI enabled insights for lighting, visibility and nighttime safety”.
- **Q3**: Mid-project review (evaluation and stakeholder feedback).
- **Q4**: Ranked priority zones, interactive visualisations, downloadable datasets (methodology open and scalable).
- **Q4–Q5**: Finalise maps, dashboard, datasets, documentation; publish via Monash open access; share with partners; complete reporting.

**Inclusions/exclusions** from the application are respected: development, pilot, evaluation, engagement, analysis, dissemination are in scope; commercialisation, long-term management, and prescriptive infrastructure advice are out of scope.

## Owner key

- **Monash (lead)** – XYX Lab leads; Council/collaborator input as needed.  
- **CrowdLab (lead)** – Technical and data lead; Monash input on requirements and evaluation.  
- **Both** – Shared (e.g. evidence base, pilot, final assets).  
- **Council** – Casey input or dependency (e.g. data access, advisory group, Bunjil Place).

## Linking to existing docs

- **Detailed delivery** (sprints, technical tasks): see [DELIVERY_PLAN.md](DELIVERY_PLAN.md).  
- **Product scope**: [PRD.md](PRD.md), [CONTEXT.md](CONTEXT.md).  
- **Backlog**: [BACKLOG.md](BACKLOG.md).  
- **Risks**: [RISKS_AND_MITIGATIONS.md](RISKS_AND_MITIGATIONS.md).

Use the CSV/Sheets as the **grant and partner-facing timeline**; use DELIVERY_PLAN and BACKLOG for **internal build and sprint planning**.

## Gantt chart (timeline)

The CSV has **Start_date** and **End_date** columns so you can use the same sheet for a timeline. Dates are placeholders (Nov 2025–Jan 2027). Update them when your real start is confirmed.

**Option A – Same sheet**: Select **Task** (or Phase + Task), **Start_date**, **End_date**. Insert → Chart → Bar. For a true Gantt you often add a **Duration_days** column (= End_date − Start_date) and use a stacked bar (first series = days from project start to task start, second series = duration). Many teams just use the table as a timeline and filter by Phase.

**Option B – Dedicated Gantt sheet**: Duplicate the sheet, hide everything except **Task**, **Phase**, **Start_date**, **End_date** (and maybe **Owner**), then use that range for a bar chart or a Gantt add-on from the Workspace Marketplace. Keeps the main sheet as the task list and the second as a visual timeline.

## Adding or changing dates

If you prefer to set dates yourself, the CSV already has **Start_date** and **End_date** filled. To shift the whole plan:

1. Agree **project start date** (e.g. 1 month after formal approval).  
2. In Sheets, use **Find and replace** on the date columns to shift all placeholders (e.g. replace the first month’s dates with your real start).  
3. Or overwrite **Start_date** and **End_date** per task; the Gantt will update automatically.

If you want, the next step can be a one-page “Project at a glance” (summary table or Gantt-style) derived from this plan for reports or partner updates.
