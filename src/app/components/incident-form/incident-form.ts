import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService, Incident, Employee } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { AiMarkdownPipe } from '../../pipes/ai-markdown.pipe';

interface Witness { name: string; phone: string; statement: string; }
interface CorrectiveAction { description: string; assignee: string; due_date: string; status: string; priority: string; }
interface WhyEntry { why: string; answer: string; }

@Component({
  selector: 'app-incident-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AiMarkdownPipe, DecimalPipe],
  templateUrl: './incident-form.html',
  styleUrl: './incident-form.scss'
})
export class IncidentFormComponent implements OnInit {
  currentStep = 1;
  totalSteps = 6;
  submitting = false;
  submitSuccess = false;
  submitError = '';
  incidentIdGenerated = '';

  aiAnalysis = '';
  aiLoading = false;

  empQuery = '';
  empResults: Employee[] = [];
  empSearching = false;

  attachmentFiles: File[] = [];

  witnesses: Witness[] = [];
  correctiveActions: CorrectiveAction[] = [];
  fiveWhys: WhyEntry[] = Array.from({length:5}, (_,i) => ({why:`Why ${i+1}`, answer:''}));

  form: Incident = {
    reporter_first: '', reporter_last: '', reporter_email: '',
    reporter_phone: '', reporter_dept: '', reporter_site: '', reporter_title: '',
    incident_type: '', urgency: 'medium',
    incident_date: '', incident_time: '', incident_site: '', incident_area: '',
    description: '', immediate_actions: '', equipment_involved: '',
    person_type: 'employee', involved_first: '', involved_last: '',
    employee_id: '', job_title: '', department: '', hire_date: '',
    supervisor_name: '', supervisor_email: '',
    injury_type: '', body_area: '', body_part: '',
    days_away: 0, days_restricted: 0, medical_treatment: '', work_related: 'yes',
    osha_recordable: false, osha_result: '',
    root_cause_category: '', training_deficiency: false, rca_method: 'whys',
    witnesses: [], corrective_actions: [], five_whys: [], attachments: []
  };

  readonly SITES = ['Deer Park','Baytown','Texas City','La Porte','Pasadena','Freeport','Port Arthur','Corporate HQ'];
  readonly DEPARTMENTS = ['Operations','Maintenance','Safety','Engineering','Logistics','QA/QC','Administration','Contractor'];
  readonly INCIDENT_TYPES = [
    {value:'injury',label:'Injury',icon:'bi-bandaid'},
    {value:'illness',label:'Illness',icon:'bi-thermometer'},
    {value:'nearmiss',label:'Near Miss',icon:'bi-exclamation-triangle'},
    {value:'vehicle',label:'Vehicle',icon:'bi-truck'},
    {value:'environmental',label:'Environmental',icon:'bi-tree'},
    {value:'property',label:'Property Damage',icon:'bi-building-x'},
    {value:'contractor',label:'Contractor',icon:'bi-person-gear'},
    {value:'security',label:'Security',icon:'bi-shield-exclamation'},
    {value:'observation',label:'Observation',icon:'bi-eye'}
  ];

  constructor(private supabase: SupabaseService, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    if (!this.auth.isAuthenticated()) this.router.navigate(['/login']);
    this.form.incident_date = new Date().toISOString().split('T')[0];
    this.form.incident_time = new Date().toTimeString().slice(0,5);
  }

  get stepProgress(): number { return (this.currentStep / this.totalSteps) * 100; }
  get stepLabels(): string[] { return ['Reporter','Incident','Involved','Injury','Investigation','Review']; }

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      if (this.currentStep === 6) this.runAiAnalysis();
    }
  }
  prevStep() { if (this.currentStep > 1) this.currentStep--; }
  goToStep(step: number) { if (step <= this.currentStep) this.currentStep = step; }

  async searchEmployee() {
    if (!this.empQuery.trim()) return;
    this.empSearching = true;
    const { data } = await this.supabase.searchEmployees(this.empQuery);
    this.empResults = data || [];
    this.empSearching = false;
  }

  selectEmployee(emp: Employee) {
    this.form.involved_first = emp.first_name;
    this.form.involved_last = emp.last_name;
    this.form.employee_id = emp.employee_id;
    this.form.job_title = emp.job_title || '';
    this.form.department = emp.department || '';
    this.form.hire_date = emp.hire_date || '';
    this.form.supervisor_name = emp.supervisor_name || '';
    this.form.supervisor_email = emp.supervisor_email || '';
    this.empResults = [];
    this.empQuery = '';
  }

  addWitness() { this.witnesses.push({name:'',phone:'',statement:''}); }
  removeWitness(i: number) { this.witnesses.splice(i,1); }

  addAction() { this.correctiveActions.push({description:'',assignee:'',due_date:'',status:'Open',priority:'medium'}); }
  removeAction(i: number) { this.correctiveActions.splice(i,1); }

  computeOsha() {
    const tx = (this.form.medical_treatment || '').toLowerCase();
    const daysAway = Number(this.form.days_away) || 0;
    const daysRestr = Number(this.form.days_restricted) || 0;
    if (this.form.incident_type === 'nearmiss' || this.form.incident_type === 'observation') {
      this.form.osha_recordable = false; this.form.osha_result = 'Not recordable — Near miss/observation'; return;
    }
    if (this.form.work_related === 'no') {
      this.form.osha_recordable = false; this.form.osha_result = 'Not recordable — Not work-related'; return;
    }
    if (tx.includes('first aid only') || tx === 'first aid') {
      this.form.osha_recordable = false; this.form.osha_result = 'Not recordable — First aid only'; return;
    }
    if (daysAway > 0 || daysRestr > 0 || tx.includes('emergency') || tx.includes('physician') ||
        tx.includes('hospital') || tx.includes('prescription') || tx.includes('surgery') || tx.includes('loss')) {
      this.form.osha_recordable = true;
      if (daysAway > 0) this.form.osha_result = `Recordable — Days Away From Work (${daysAway} days)`;
      else if (daysRestr > 0) this.form.osha_result = `Recordable — Job Transfer / Restricted Duty (${daysRestr} days)`;
      else this.form.osha_result = 'Recordable — Medical Treatment Beyond First Aid';
      return;
    }
    this.form.osha_recordable = false; this.form.osha_result = 'Not recordable — No criteria met';
  }

  runAiAnalysis() {
    this.aiLoading = true; this.aiAnalysis = '';
    setTimeout(() => { this.aiAnalysis = this.generateAnalysis(); this.aiLoading = false; }, 900);
  }

  private generateAnalysis(): string {
    const lines: string[] = [];
    const type = this.form.incident_type || 'incident';
    const site = this.form.incident_site || 'site';
    const area = this.form.incident_area || 'area';
    const urgency = this.form.urgency || 'medium';
    const daysAway = Number(this.form.days_away) || 0;
    const daysRestr = Number(this.form.days_restricted) || 0;
    const rootCause = this.form.root_cause_category || '';
    const tx = (this.form.medical_treatment || '').toLowerCase();

    lines.push('## AI Safety Analyst Report\n');

    let severity = 'LOW';
    if (urgency === 'immediate' || daysAway >= 7) severity = 'HIGH';
    else if (urgency === 'high' || daysAway >= 1) severity = 'MEDIUM';
    lines.push(`**Severity Assessment:** ${severity}`);

    const typeLabels: Record<string,string> = {
      injury:'Occupational Injury', illness:'Occupational Illness', nearmiss:'Near-Miss Event',
      vehicle:'Vehicle / Fleet Incident', environmental:'Environmental Release',
      property:'Property Damage', contractor:'Contractor Incident',
      security:'Security Incident', observation:'Safety Observation'
    };
    lines.push(`**Classification:** ${typeLabels[type] || type}`);
    lines.push(`**Location:** ${site} — ${area}`);
    if (this.form.osha_recordable) lines.push(`\n⚠️ **OSHA Recordable** — ${this.form.osha_result}`);

    lines.push('\n### Immediate Recommendations');
    const recs: string[] = [];
    if (urgency === 'immediate') recs.push('🔴 **Suspend operations** in affected area pending investigation');
    if (type === 'injury') { recs.push('📋 Conduct immediate job-site hazard reassessment'); recs.push('🦺 Verify PPE compliance in this work area'); }
    if (type === 'vehicle') recs.push('🚗 Remove vehicle from service; review driver records');
    if (type === 'environmental') recs.push('🌿 Initiate release protocol; notify HSE manager immediately');
    if (this.form.training_deficiency) recs.push('📚 Prioritize refresher training for affected personnel');
    if (daysAway >= 1) recs.push(`🏥 Coordinate return-to-work program (${daysAway} lost days)`);
    recs.push('📸 Preserve incident scene; collect physical evidence');
    recs.push('🗣️ Interview all witnesses within 24 hours');
    recs.forEach(r => lines.push(`- ${r}`));

    lines.push('\n### Root Cause Indicators');
    const rcaMap: Record<string,string> = {
      'human-error':'Human Error — review task clarity, fatigue management, distraction controls',
      'equipment':'Equipment Failure — inspect maintenance logs; consider predictive maintenance',
      'environment':'Environmental Conditions — evaluate housekeeping, lighting, slip/trip controls',
      'procedure':'Procedure Gap — audit SOP currency; assess procedural compliance culture',
      'training':'Training Deficiency — gap-assess competency; update onboarding/refresher programs',
      'management':'Management System — review supervision, permit-to-work, MOC processes'
    };
    if (rootCause && rcaMap[rootCause]) lines.push(`- **${rcaMap[rootCause]}**`);
    else lines.push('- Complete root cause fields (Step 5) for targeted corrective action guidance');

    lines.push('\n### OSHA Regulatory Flags');
    if (this.form.osha_recordable) {
      lines.push('- ✅ Record on OSHA 300 Log within 7 calendar days');
      lines.push('- ✅ Complete OSHA 301 Incident Report within 7 calendar days');
      if (daysAway >= 1) lines.push(`- ✅ Verify Day 1 of absence counted correctly for 300 Log`);
    } else {
      lines.push('- No OSHA 300 entry required based on current data');
    }
    if (urgency === 'immediate') lines.push('- ⚡ **OSHA 24-hr report required** if hospitalization, amputation, or fatality');

    lines.push('\n*Analysis by AI Safety Analyst v2.0 — Review before distribution*');
    return lines.join('\n');
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) for (let i = 0; i < input.files.length; i++) this.attachmentFiles.push(input.files[i]);
  }
  removeFile(i: number) { this.attachmentFiles.splice(i,1); }
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1048576).toFixed(1) + ' MB';
  }

  async submitForm() {
    this.submitting = true; this.submitError = '';
    const now = new Date();
    const incidentId = `INC-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`;
    this.incidentIdGenerated = incidentId;

    const attachmentData: any[] = [];
    for (const file of this.attachmentFiles) {
      const {url} = await this.supabase.uploadFile(file, incidentId);
      if (url) attachmentData.push({name:file.name, url, size:file.size, type:file.type});
    }

    const payload: Incident = {
      ...this.form, incident_id: incidentId,
      witnesses: this.witnesses,
      corrective_actions: this.correctiveActions,
      five_whys: this.fiveWhys.filter(w => w.answer.trim()),
      attachments: attachmentData
    };

    const {error} = await this.supabase.createIncident(payload);
    this.submitting = false;
    if (error) this.submitError = `Submission failed: ${error.message}`;
    else this.submitSuccess = true;
  }

  newIncident() {
    this.submitSuccess = false; this.currentStep = 1;
    this.attachmentFiles = []; this.witnesses = []; this.correctiveActions = [];
    this.fiveWhys = Array.from({length:5}, (_,i) => ({why:`Why ${i+1}`, answer:''}));
    this.form = {
      reporter_first:'',reporter_last:'',reporter_email:'',reporter_phone:'',reporter_dept:'',reporter_site:'',reporter_title:'',
      incident_type:'',urgency:'medium',
      incident_date:new Date().toISOString().split('T')[0],
      incident_time:new Date().toTimeString().slice(0,5),
      incident_site:'',incident_area:'',description:'',immediate_actions:'',equipment_involved:'',
      person_type:'employee',involved_first:'',involved_last:'',employee_id:'',job_title:'',department:'',hire_date:'',
      supervisor_name:'',supervisor_email:'',injury_type:'',body_area:'',body_part:'',
      days_away:0,days_restricted:0,medical_treatment:'',work_related:'yes',
      osha_recordable:false,osha_result:'',root_cause_category:'',training_deficiency:false,rca_method:'whys',
      witnesses:[],corrective_actions:[],five_whys:[],attachments:[]
    };
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
