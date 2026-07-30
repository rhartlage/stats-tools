const cases=[
{text:"A retailer emails a satisfaction survey only to loyalty-program members who made a purchase in the last 30 days, then reports that all customers are highly satisfied.",target:"All customers",observed:"Recent loyalty buyers",design:"Voluntary response",threat:"coverage",repair:"sample",why:"The frame excludes nonmembers, nonbuyers, and less-engaged customers. Their experiences may differ.",fix:"Draw a probability sample from the full customer file and follow up with selected nonrespondents."},
{text:"A manager compares productivity in volunteers who chose a standing-desk pilot with coworkers who kept their usual desks, then attributes the difference to the desks.",target:"All employees",observed:"Self-selected volunteers",design:"Observational",threat:"confounding",repair:"randomize",why:"Motivation, health, role, or prior productivity can differ before the treatment begins.",fix:"Randomly assign eligible employees to conditions, or state that the observational result is association only."},
{text:"A restaurant asks guests at the register, in front of the shift manager, whether service was excellent.",target:"All diners",observed:"Guests willing to answer publicly",design:"Intercept survey",threat:"measurement",repair:"privacy",why:"The wording and public setting can encourage socially desirable answers.",fix:"Use neutral wording and a private, consistently administered response method."},
{text:"An analyst removes all unusually long delivery times as errors without checking records, then reports on-time performance.",target:"All deliveries",observed:"Trimmed delivery file",design:"Administrative data",threat:"processing",repair:"audit",why:"Extreme values may be real service failures. Outcome-dependent deletion biases the result.",fix:"Predefine data-quality rules, verify flagged records, and report sensitivity with and without justified exclusions."},
{text:"A company launches a promotion in December and compares sales with November, calling the increase a causal promotion effect.",target:"Promotion effect",observed:"Two consecutive months",design:"Before-after",threat:"history",repair:"control",why:"Seasonality and other month-to-month changes are mixed with the promotion effect.",fix:"Use a comparable control market or a longer time series that separates seasonal patterns from the intervention."}
];
const threatOptions=[["coverage","Undercoverage / selection"],["confounding","Confounding / self-selection"],["measurement","Response or measurement bias"],["processing","Outcome-dependent data processing"],["history","History / time-related confounding"]];
const repairOptions=[["sample","Use a full-frame probability sample"],["randomize","Randomly assign or limit the claim"],["privacy","Use neutral private measurement"],["audit","Predefine and audit exclusions"],["control","Add a control or seasonal comparison"]];
const seed=document.querySelector("#seed"),scenario=document.querySelector("#scenario"),target=document.querySelector("#target"),observed=document.querySelector("#observed"),design=document.querySelector("#design"),feedback=document.querySelector("#feedback");
let current;
function drawChoices(root,name,options){root.innerHTML=options.map(([v,t])=>`<label class="choice"><input type="radio" name="${name}" value="${v}"><span>${t}</span></label>`).join("");}
function optionLabel(options,value){return options.find(([v])=>v===value)?.[1]??value;}
drawChoices(document.querySelector("#threats"),"threat",threatOptions);drawChoices(document.querySelector("#repairs"),"repair",repairOptions);
function load(){const s=Math.max(1,Math.floor(Number(seed.value)||2150));seed.value=s;current=cases[(s*17+s%7)%cases.length];scenario.textContent=current.text;target.textContent=current.target;observed.textContent=current.observed;design.textContent=current.design;feedback.innerHTML='<div class="result"><h3>Case loaded</h3><p>Predict the primary threat and the best repair before checking.</p></div>';document.querySelectorAll('input[type=radio]').forEach(x=>x.checked=false);}
document.querySelector("#same").onclick=load;document.querySelector("#next").onclick=()=>{seed.value=(Number(seed.value)||2150)+1;load();};
document.querySelector("#check").onclick=()=>{
  const a=document.querySelector('input[name=threat]:checked')?.value;
  const b=document.querySelector('input[name=repair]:checked')?.value;
  if(!a||!b){
    feedback.innerHTML='<div class="result warning"><h3>Complete both choices</h3><p>Select the threat and repair so the feedback can address your full diagnosis.</p></div>';
    return;
  }

  const threatCorrect=a===current.threat;
  const repairCorrect=b===current.repair;
  const summary=threatCorrect&&repairCorrect
    ?"Well diagnosed"
    :threatCorrect||repairCorrect
      ?"One response is correct"
      :"Reconsider the design";
  const selectedThreat=optionLabel(threatOptions,a);
  const correctThreat=optionLabel(threatOptions,current.threat);
  const selectedRepair=optionLabel(repairOptions,b);
  const correctRepair=optionLabel(repairOptions,current.repair);

  feedback.innerHTML=`
    <div class="feedback-summary">
      <h3>${summary}</h3>
      <p>Each response is evaluated separately.</p>
    </div>
    <div class="feedback-grid">
      <div class="result ${threatCorrect?"success":"error"}">
        <h3>Primary threat — ${threatCorrect?"Correct":"Needs revision"}</h3>
        <p><strong>Your response:</strong> ${selectedThreat}.</p>
        ${threatCorrect?"":`<p><strong>Correct response:</strong> ${correctThreat}.</p>`}
        <p>${current.why}</p>
      </div>
      <div class="result ${repairCorrect?"success":"error"}">
        <h3>Best repair — ${repairCorrect?"Correct":"Needs revision"}</h3>
        <p><strong>Your response:</strong> ${selectedRepair}.</p>
        ${repairCorrect?"":`<p><strong>Correct response:</strong> ${correctRepair}.</p>`}
        <p>${current.fix}</p>
      </div>
    </div>
    <p class="feedback-note">Other weaknesses may exist, but prioritize the one most capable of changing the decision.</p>`;
};
load();
