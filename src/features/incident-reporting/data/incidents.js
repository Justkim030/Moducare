export const INCIDENT_SEVERITIES = {
  S1: { label: 'S1 - Catastrophic', color: 'var(--clr-danger)' },
  S2: { label: 'S2 - Severe Harm', color: '#ff6b6b' },
  S3: { label: 'S3 - Moderate Harm', color: '#fcc419' },
  S4: { label: 'S4 - Minor Harm', color: '#339af0' },
  S5: { label: 'S5 - Near-Miss / No Harm', color: 'var(--clr-success)' }
};

export const INCIDENT_CATEGORIES = [
  'Patient Safety (Falls, Medication Error)',
  'Clinical Near-Miss',
  'Equipment & Facilities Malfunction',
  'Infection Control Breach',
  'Staff Safety / Needle Stick',
  'Patient Complaint / Conduct'
];

export const MOCK_INCIDENTS = [
  {
    id: "INC-2026-001",
    date: "2026-06-01",
    time: "09:30",
    category: "Patient Safety (Falls, Medication Error)",
    severity: "S3",
    patientId: "PAT-8842",
    reporterName: "Dr. Kamau",
    reporterRole: "Medical Officer",
    description: "Patient slipped while unassisted walking to the bathroom. Minor bruising on right elbow.",
    actionTaken: "Cold compress applied, vitals monitored, X-ray ordered.",
    status: "Under Review"
  },
  {
    id: "INC-2026-002",
    date: "2026-06-03",
    time: "14:15",
    category: "Staff Safety / Needle Stick",
    severity: "S2",
    patientId: "PAT-0114",
    reporterName: "Nurse Jane",
    reporterRole: "Registered Nurse",
    description: "Accidental needle-stick injury occurred during recapping post-blood draw.",
    actionTaken: "Wound washed thoroughly, reported to Employee Health, baseline labs drawn.",
    status: "Action Taken"
  },
  {
    id: "INC-2026-003",
    date: "2026-06-05",
    time: "11:00",
    category: "Clinical Near-Miss",
    severity: "S5",
    patientId: "PAT-9531",
    reporterName: "Pharm. Omondi",
    reporterRole: "Pharmacist",
    description: "Prescription received for 10 units of regular insulin; intended dose was 1 unit. Intercepted before dispensing.",
    actionTaken: "Clarified script with prescribing practitioner. Correct dose dispensed.",
    status: "Closed"
  }
];
