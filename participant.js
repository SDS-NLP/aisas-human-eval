/* Participant (Prolific) UI for change-point marking. English only. No dependencies; works from file:// or a static server.
 * Separate from the researcher UI (index.html / app.js). Shares the same marking semantics:
 *   a mark = "from this step on, the stage is <label>"; marks are the only stored truth; UI shows segments as a visual aid.
 * Fail-closed: anything required that is missing in participant_config.js is listed in English and blocks the live flow. */
(function () {
  "use strict";

  const CFG = window.PARTICIPANT_CONFIG || {};
  const DATA = window.PARTICIPANT_DATA;
  const CODEBOOK = window.PARTICIPANT_CODEBOOK;
  const main = document.getElementById("main");
  const viewer = document.getElementById("viewer");
  const shead = document.getElementById("session-head");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  if (!DATA || !DATA.sessions) {
    main.innerHTML = '<div class="panel narrow error">The study data could not be loaded (data/participant_data.js is missing). Please message the researcher.</div>';
    return;
  }
  const LABELS = DATA.meta.label_order; // codebook v002: interest, search, action, uncertain
  const LABEL_NAME = { interest: "Interest", search: "Search", action: "Action", uncertain: "Uncertain" };
  // The codebook version is part of every stored state key and every export / submission, so marks made under the old
  // 6-label codebook v001 (where Interest / Search meant something else) are never loaded or merged as v002 marks.
  const CODEBOOK_VERSION = DATA.meta.codebook_version || "v001";
  if (CODEBOOK && CODEBOOK.codebook_version && CODEBOOK.codebook_version !== CODEBOOK_VERSION) console.warn(`stage guide is for codebook ${CODEBOOK.codebook_version}, data bundle is ${CODEBOOK_VERSION}`);
  const SHOT_DIR = "data/screenshots/";
  const SESSION_BY_UID = new Map(DATA.sessions.map((s) => [s.session_uid, s]));

  // ---------- URL params / dev preview ----------
  const params = new URLSearchParams(location.search);
  // LOCAL EVALUATION mode: the researcher evaluates on their own machine. Automatic when the page is opened from file://
  // (unless config.local.allow_file === false, used by tests to simulate a hosted page). On http(s) it needs BOTH
  // ?local=1 and config.local.allow_local === true, so a live https deployment cannot be bypassed by a URL parameter.
  const LOCAL = (location.protocol === "file:" && !(CFG.local && CFG.local.allow_file === false))
    || (params.get("local") === "1" && !!(CFG.local && CFG.local.allow_local === true));
  const DEV = !LOCAL && params.get("dev") === "1" && CFG.dev && CFG.dev.allow_preview === true;
  document.getElementById("dev-banner").hidden = !DEV;
  document.getElementById("local-banner").hidden = !LOCAL;
  if (DEV) document.title += " (DEVELOPMENT PREVIEW)";
  if (LOCAL) document.title += " (LOCAL EVALUATION)";
  for (const id of ["btn-export", "btn-import", "save-status"]) document.getElementById(id).hidden = !LOCAL;

  // ---------- configuration readiness (fail-closed) ----------
  const isPlaceholder = (v) => typeof v !== "string" || !v.trim() || /\[CONFIG REQUIRED/i.test(v);
  const upar = (CFG.allocation && CFG.allocation.url_params) || { sessions: "sessions", token: "alloc" };
  const allocToken = params.get(upar.token) || (CFG.allocation && CFG.allocation.token) || null;
  function resolveAssigned() {
    if (LOCAL) return { sessions: DATA.sessions.slice(), source: "local-all-bundled", unknown: [] }; // every session in the bundle, Session 1..N
    let list = null, source = null;
    const fromUrl = params.get(upar.sessions);
    if (fromUrl) { list = fromUrl.split(",").map((x) => x.trim()).filter(Boolean); source = "url"; }
    else if (CFG.allocation && Array.isArray(CFG.allocation.sessions) && CFG.allocation.sessions.length) { list = CFG.allocation.sessions.slice(); source = "config"; }
    else if (DEV && CFG.dev && Array.isArray(CFG.dev.preview_sessions) && CFG.dev.preview_sessions.length) { list = CFG.dev.preview_sessions.slice(); source = "dev-preview"; }
    if (!list) return { sessions: null, source: null, unknown: [] };
    const unknown = list.filter((u) => !SESSION_BY_UID.has(u));
    return { sessions: list.filter((u) => SESSION_BY_UID.has(u)).map((u) => SESSION_BY_UID.get(u)), source, unknown };
  }
  const ASSIGNED = resolveAssigned();

  function readiness() {
    const missing = [];
    const st = CFG.study || {};
    if (isPlaceholder(CFG.study_id)) missing.push("study_id");
    for (const k of ["institution", "contact", "ethics", "data_retention", "data_sharing", "payment_text"]) if (isPlaceholder(st[k])) missing.push("study." + k);
    if (!(typeof st.estimated_minutes === "number" && st.estimated_minutes > 0)) missing.push("study.estimated_minutes");
    if (!Array.isArray(CFG.practice) || !CFG.practice.length) missing.push("practice (practice sessions + comprehension check)");
    if (!(CFG.endpoint && CFG.endpoint.url)) missing.push("endpoint.url (where results are sent)");
    // completion.from_endpoint === true: the code / URL comes from the endpoint's success response (json.completion), so none is needed here
    if (!(CFG.completion && (CFG.completion.from_endpoint === true || CFG.completion.url || CFG.completion.code))) missing.push("completion.url, completion.code or completion.from_endpoint");
    if (!allocToken) missing.push(`allocation token (URL parameter "${upar.token}" or allocation.token)`);
    if (!ASSIGNED.sessions || !ASSIGNED.sessions.length || ASSIGNED.source === "dev-preview") missing.push(`assigned sessions (URL parameter "${upar.sessions}" or allocation.sessions)`);
    if (ASSIGNED.unknown.length) missing.push("assigned sessions not found in data: " + ASSIGNED.unknown.join(", "));
    return { ready: missing.length === 0, missing };
  }
  const READY = readiness();
  const canProceedGate = () => READY.ready || DEV || LOCAL; // DEV/LOCAL may walk the flow; neither fabricates submission/completion

  // ---------- state (namespaced per study + allocation; the researcher's aisas_human_eval_v* keys are never touched) ----------
  function bundleFingerprint() { // stable per bundle content: scope + count + hash of sorted session_uids
    let h = 5381; for (const u of DATA.sessions.map((x) => x.session_uid).sort()) for (let i = 0; i < u.length; i++) h = ((h * 33) ^ u.charCodeAt(i)) >>> 0;
    return `${DATA.meta.session_scope || "unknown"}:${DATA.sessions.length}:${h.toString(16)}`;
  }
  const BUNDLE_FP = bundleFingerprint();
  const NS_KEY = LOCAL ? `aisas_local_eval_v1:cb-${CODEBOOK_VERSION}:${BUNDLE_FP}`
    : `aisas_prolific_v1:cb-${CODEBOOK_VERSION}:${isPlaceholder(CFG.study_id) ? "unconfigured" : CFG.study_id}:${allocToken || "noalloc"}`;
  function blankTiming() { return { practice: {}, sessions: {}, events: [], events_dropped: 0 }; }
  function blankState() { return { consent_at: null, practice: { attempts: {}, passed: false, skipped_dev: false, marks: {} }, marks: {}, sessions: {}, timing: blankTiming(), submission: { status: "none", attempts: 0, receipt: null, submitted_at: null, last_error: null } }; }
  let state = loadState();
  function loadState() {
    try { const raw = localStorage.getItem(NS_KEY); if (raw) { const s = JSON.parse(raw); const b = blankState(); return { ...b, ...s, practice: { ...b.practice, ...(s.practice || {}) }, timing: { ...b.timing, ...(s.timing || {}) }, submission: { ...b.submission, ...(s.submission || {}) } }; } }
    catch (e) { console.warn("state read failed", e); }
    return blankState();
  }
  let saveTimer = null;
  let lastSavedAt = null;
  function persist() {
    flushActive();
    try { localStorage.setItem(NS_KEY, JSON.stringify(state)); lastSavedAt = new Date(); renderSaveStatus(true); }
    catch (e) { renderSaveStatus(false, e.message); toast("Your progress could not be saved in this browser: " + e.message); }
  }
  function renderSaveStatus(ok, msg) {
    if (!LOCAL) return;
    const el = document.getElementById("save-status");
    el.textContent = ok ? `Saved ${lastSavedAt.toLocaleTimeString()} (this browser only)` : `Not saved: ${msg}`;
    el.classList.toggle("save-error", !ok);
  }
  function saveState() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = null; persist(); renderHeader(); }, 250); }
  // Write only when this page has something to save (a pending change, or time on screen to add): a page that merely
  // closes must not overwrite what another tab of the same link saved.
  function persistPending() { if (saveTimer || activeTarget) { clearTimeout(saveTimer); saveTimer = null; persist(); } }
  window.addEventListener("beforeunload", () => persistPending());
  const now = () => new Date().toISOString();
  const marksOf = (uid) => state.marks[uid] || {};
  const LOCKED = () => !LOCAL && state.submission.status === "submitted";

  // ---------- timing (decided 2026-10-21): phase times, time on screen per session, and a short event log ----------
  // Used to measure where the time goes in the pilot (and in LOCAL mode, the researcher's own time). Recorded only after
  // consent (LOCAL: after "Start local evaluation"); every event has t = ms since then. Nothing is recorded after submission.
  // active_ms = time the session (or practice item) was on screen while the tab was visible.
  const MAX_EVENTS = 3000;
  const MAX_T_MS = 3 * 86400 * 1000; // the endpoint accepts t and active_ms up to 3 days; later events are counted as dropped
  const MAX_GAP_MS = 60000; // the time counter ticks every 15 s; a longer gap (timers suspended, e.g. the computer slept) counts as 60 s at most
  const TM = () => state.timing || (state.timing = blankTiming());
  const startMs = () => Date.parse(LOCAL ? state.local_started_at : state.consent_at);
  function logEvent(e, fields) {
    const t0 = startMs();
    if (!Number.isFinite(t0) || LOCKED()) return;
    const tm = TM(); const t = Math.max(0, Date.now() - t0);
    if (tm.events.length >= MAX_EVENTS || t > MAX_T_MS) { tm.events_dropped = (tm.events_dropped || 0) + 1; return; }
    const ev = { t, e };
    for (const [k, v] of Object.entries(fields || {})) if (v !== null && v !== undefined) ev[k] = v; // never send an empty field
    tm.events.push(ev);
    saveState();
  }
  function stampOnce(obj, key) { if (obj && !obj[key]) obj[key] = now(); }
  let activeTarget = null, activeSince = null; // {kind: "sessions"|"practice", key}
  const visible = () => document.visibilityState === "visible";
  function flushActive() {
    if (activeTarget && activeSince !== null) {
      const d = Math.min(Math.max(0, Date.now() - activeSince), MAX_GAP_MS);
      if (!LOCKED()) { const rec = TM()[activeTarget.kind][activeTarget.key] ||= {}; rec.active_ms = Math.min((rec.active_ms || 0) + d, MAX_T_MS); }
    }
    activeSince = activeTarget && visible() ? Date.now() : null;
  }
  function setActive(kind, key) {
    flushActive();
    activeTarget = kind && !LOCKED() ? { kind, key } : null;
    activeSince = activeTarget && visible() ? Date.now() : null;
    if (activeTarget) stampOnce(TM()[kind][key] ||= {}, "first_opened_at");
  }
  setInterval(() => { if (activeTarget && activeSince !== null) persist(); }, 15000);
  document.addEventListener("visibilitychange", () => { logEvent(visible() ? "visible" : "hidden"); if (!visible()) persistPending(); else flushActive(); });
  window.addEventListener("pagehide", () => persistPending());
  // s in events: 1-based number of the assigned session, or "practice"
  const evSession = () => current ? (current.opts.practice ? "practice" : current.opts.index + 1) : null;
  const evPos = (logId) => current ? current.s.logs.find((l) => l.log_id === logId)?.pos || 0 : 0;
  function buildTiming() {
    flushActive();
    const tm = TM(); const ms = (v) => Math.min(Math.round(Number(v) || 0), MAX_T_MS); const ts = (v) => (typeof v === "string" ? v : null);
    return {
      schema: "aisas_timing_v1", instructions_done_at: ts(tm.instructions_done_at), practice_checked_at: ts(tm.practice_checked_at),
      review_opened_at: ts(tm.review_opened_at), submit_opened_at: ts(tm.submit_opened_at),
      practice: LOCAL ? [] : practiceItems().map((it, k) => { const id = it.id || `practice_${k + 1}`; const x = tm.practice[id] || {};
        return { id, first_opened_at: ts(x.first_opened_at), checked_at: ts(x.checked_at), active_ms: ms(x.active_ms) }; }),
      sessions: (ASSIGNED.sessions || []).map((x) => { const r = tm.sessions[x.session_uid] || {};
        return { session_uid: x.session_uid, first_opened_at: ts(r.first_opened_at), completed_at: ts(r.completed_at), active_ms: ms(r.active_ms) }; }),
      events: tm.events.slice(0, MAX_EVENTS), events_dropped: tm.events_dropped || 0,
    };
  }

  // ---------- helpers ----------
  function fmtT(sec) { const s = Math.round(sec); const m = Math.floor(s / 60), r = s % 60; return (m ? m + "m " : "") + r + "s"; }
  function chip(label, extra) { return label ? `<span class="chip ${label} ${extra || ""}">${LABEL_NAME[label] || esc(label)}</span>` : `<span class="chip none ${extra || ""}">Not set</span>`; }
  function pageBadge(kind) { return `<span class="pagebadge" style="background:var(--page-${esc(kind)}, #f3f4f6)">${esc(String(kind).replace(/_/g, " "))}</span>`; }
  const ACTION_NAME = { click: "Click", scroll: "Scroll", input: "Typed input", navigation: "Page navigation", tab_activate: "Tab switch" };
  function segmentLabels(logs, marks) { const out = []; let cur = null; for (const l of logs) { if (marks[l.log_id]) cur = marks[l.log_id].label; out.push(cur); } return out; }
  let toastTimer;
  const compAnswers = {}; // practice id -> {question index: option} chosen but not yet checked (survives re-renders)
  let compNotice = null; // {pid, text}: shown inside the comprehension panel (a toast alone was easy to miss)
  function toast(msg) { const el = document.getElementById("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500); }

  // ---------- header / stepper ----------
  const STEPS = LOCAL
    ? [["consent", "Start"], ["instructions", "Instructions"], ["sessions", "Sessions"], ["review", "Review"], ["export", "Export"]]
    : [["consent", "Consent"], ["instructions", "Instructions"], ["practice", "Practice"], ["sessions", "Sessions"], ["review", "Review"], ["submit", "Submit"]];
  const started = () => LOCAL ? !!state.local_started_at : !!state.consent_at;
  function stepDone(id) {
    switch (id) {
      case "consent": return started();
      case "instructions": return started() && !!state.instructions_read;
      case "export": return !!state.last_export_at;
      case "practice": return practiceDone();
      case "sessions": return !!ASSIGNED.sessions && ASSIGNED.sessions.length > 0 && ASSIGNED.sessions.every((s) => state.sessions[s.session_uid]?.completed);
      case "review": return !!state.review_confirmed;
      case "submit": return LOCKED();
      default: return false;
    }
  }
  function renderHeader(currentStep) {
    const cur = currentStep || currentStepId();
    document.getElementById("stepper").innerHTML = STEPS.map(([id, name]) => `<span class="${id === cur ? "current" : stepDone(id) ? "done" : ""}">${name}</span>`).join("");
    const n = ASSIGNED.sessions ? ASSIGNED.sessions.length : 0;
    const done = ASSIGNED.sessions ? ASSIGNED.sessions.filter((s) => state.sessions[s.session_uid]?.completed).length : 0;
    document.getElementById("progress").textContent = n ? `Sessions completed: ${done} / ${n}` : "";
  }
  let lastStep = "consent";
  function currentStepId() { return lastStep; }

  // ---------- consent ----------
  function cfgText(v, label) { return isPlaceholder(v) ? `<span class="config-missing">[CONFIG REQUIRED: ${esc(label)}]</span>` : esc(v); }
  function renderLocalStart() {
    lastStep = "consent"; viewer.hidden = true;
    const n = ASSIGNED.sessions.length; const nLogs = ASSIGNED.sessions.reduce((a, x) => a + x.logs.length, 0);
    const done = ASSIGNED.sessions.filter((x) => state.sessions[x.session_uid]?.completed).length;
    main.innerHTML = `<div class="narrow"><div class="panel">
      <h2>Local evaluation</h2>
      <div class="notice"><b>LOCAL EVALUATION mode.</b> This page was opened locally, so the Prolific study configuration (briefing text, practice, result endpoint,
        completion code, allocation) is not applied. Nothing is sent anywhere. Your marks are saved automatically in this browser's storage
        (key <span class="mono">${esc(NS_KEY)}</span>) and can be exported as a JSON file at any time.</div>
      <p>Sessions in this bundle: <b>${n}</b> (${nLogs} steps, bundle scope <span class="mono">${esc(DATA.meta.session_scope || "unknown")}</span>). ${done ? `Completed so far: ${done} / ${n}.` : ""}</p>
      <p>For each session, choose the stage the shopper starts in on step #1 and mark each step where the stage changes. Screenshots, actions and the shopper's
        own rationale are shown as context. Stage definitions are in the <b>Stage guide</b> (top right).</p>
      <p class="muted small">Browser storage is not a permanent backup: it is per browser profile and can be cleared. Use <b>Export progress</b> regularly and keep the
        files. The exported file (raw change points with session / step identifiers) is the input to the comparison script; it contains no model labels.</p>
      <div class="actions"><button id="btn-agree" class="btn btn-primary">${started() ? "Continue local evaluation" : "Start local evaluation"}</button>
        ${started() ? '<a class="btn" href="#/sessions">Go to sessions</a>' : ""}</div>
    </div></div>`;
    document.getElementById("btn-agree").addEventListener("click", () => { if (!state.local_started_at) state.local_started_at = now(); persist(); location.hash = "#/instructions"; });
    renderHeader("consent");
  }
  function renderConsent() {
    if (LOCAL) { renderLocalStart(); return; }
    lastStep = "consent"; viewer.hidden = true;
    const st = CFG.study || {};
    const block = READY.ready ? "" : `<div class="blocker"><b>This study is not fully set up yet.</b> Participation is disabled until the research team completes the configuration.
      If you reached this page from Prolific, please do not continue: return your submission and message the researcher.<ul>${READY.missing.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>`;
    main.innerHTML = `<div class="narrow">
      <div class="panel">
        <h2>${esc(st.title || "Shopping journey stages")}</h2>
        ${block}
        <h3>Who is running this study</h3><p>${cfgText(st.institution, "institution / research team")}</p>
        <h3>What you will do</h3>
        <p>You will look at ${ASSIGNED.sessions ? ASSIGNED.sessions.length : "[N]"} recorded shopping sessions on Amazon.com, step by step, with screenshots where they were recorded.
        For each session you will choose the stage the shopper starts in and mark the steps where the stage changes. Estimated time: ${typeof st.estimated_minutes === "number" ? esc(st.estimated_minutes) + " minutes" : '<span class="config-missing">[CONFIG REQUIRED: estimated minutes]</span>'}.</p>
        <p>The sessions come from the public OPeRA dataset (CC BY 4.0). They were recorded from other people and contain no information about you.</p>
        <h3>Payment</h3><p>${cfgText(st.payment_text, "reward and approval timeline")}</p>
        <h3>Your data</h3><p>${cfgText(st.data_retention, "what is recorded and how long it is kept")}</p><p>${cfgText(st.data_sharing, "publication / sharing of anonymised markings")}</p>
        <h3>Ethics</h3><p>${cfgText(st.ethics, "ethics approval statement")}</p>
        <h3>Contact</h3><p>${cfgText(st.contact, "contact")}</p>
        <h3>Your choice</h3>
        <p>Taking part is voluntary. You can stop at any time by closing this page and returning your submission on Prolific. If you prefer not to take part, simply return the submission now; nothing is recorded.</p>
        <div class="actions">
          <button id="btn-agree" class="btn btn-primary" ${canProceedGate() ? "" : "disabled"}>I have read the information and agree to take part</button>
          <span class="muted">or return your submission on Prolific to decline</span>
        </div>
        ${state.consent_at ? `<p class="muted small">You agreed on ${esc(new Date(state.consent_at).toLocaleString())}. <a href="#/instructions">Continue</a></p>` : ""}
      </div></div>`;
    const b = document.getElementById("btn-agree");
    if (b) b.addEventListener("click", () => { if (!state.consent_at) state.consent_at = now(); persist(); location.hash = "#/instructions"; });
    renderHeader("consent");
  }

  // ---------- instructions ----------
  function renderInstructions() {
    lastStep = "instructions"; viewer.hidden = true;
    if (!started()) { location.hash = "#/consent"; return; }
    main.innerHTML = `<div class="narrow"><div class="panel">
      <h2>How to mark a session</h2>
      <ol>
        <li><b>Go through the steps in order.</b> Each row is one step: the action (click, scroll, typed input, page navigation, tab switch), the page, and a thumbnail when a screenshot was recorded. Click a row (or use the arrow keys) to see the screenshot and details on the right. Click the screenshot to enlarge it.</li>
        <li><b>On step #1, choose the stage the shopper starts in.</b> Use the stage buttons in the row or in the panel on the right.</li>
        <li><b>Whenever the stage changes, click the new stage on the step where the change happens.</b> You only mark the first step and each change point. The coloured band on the left shows how your marks extend to the following steps. If the stage never changes, the starting stage is all you need.</li>
        <li><b>Correct a mark</b> by clicking another stage on the same step; remove it with the × button.</li>
        <li>Some steps show a <b>shopper rationale</b>: a short note the shopper wrote about what they were doing at that moment. Use it as one more piece of context.</li>
        <li>When you are done with a session, press <b>Mark this session as complete</b>. You can reopen and change it until you submit.</li>
        ${LOCAL ? "<li>You can <b>review</b> and <b>export</b> your progress at any time from the Review page or the Export button at the top.</li>"
                : "<li>After all sessions, <b>review</b> them and <b>submit</b>. The completion step appears only after your results have been received.</li>"}
      </ol>
      <h3>The stages</h3>
      <p>There are four labels. Please use them <b>exactly as defined here</b>, even where the everyday meaning of the word differs: in this study,
        <b>searching</b> for products and looking through search results counts as ${chip("interest")}, while looking closely at <b>one specific product</b> counts as ${chip("search")}.
        The full guide, with definitions and examples, is available at any time from the <b>Stage guide</b> button at the top right. In short:</p>
      <ul>${LABELS.map((k) => `<li>${chip(k)} — ${esc(CODEBOOK.labels[k].definition)}</li>`).join("")}</ul>
      ${CODEBOOK.quick_rules && CODEBOOK.quick_rules.length ? `<p>Quick rules:</p><ul>${CODEBOOK.quick_rules.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <p>Judge from the observable steps and the surrounding context of the same session. The stages do not have to occur in order.</p>
      <div class="actions"><a class="btn" href="#/consent">Back</a><button id="btn-next" class="btn btn-primary">${LOCAL ? "Continue to sessions" : "Continue to practice"}</button></div>
    </div></div>`;
    document.getElementById("btn-next").addEventListener("click", () => { state.instructions_read = true; stampOnce(TM(), "instructions_done_at"); persist(); location.hash = LOCAL ? "#/sessions" : "#/practice"; });
    renderHeader("instructions");
  }

  // ---------- practice + comprehension ----------
  // Decided 2026-10-21: one check per practice item, no attempt limit and no exclusion. After "Check answers" the answers are
  // locked and shown in colour (intended answer green, a different chosen answer red), and the participant continues to the
  // sessions even if some answers were not as intended. Payload (unchanged shape): practice.passed = every answer of every
  // item was as intended at its check; practice.attempts[id] = 1 once the item has been checked.
  function showCompPanel() { const el = document.getElementById("comp-panel"); if (el) el.scrollIntoView({ block: "start" }); }
  function practiceItems() { return Array.isArray(CFG.practice) ? CFG.practice : []; }
  function practiceDone() { return !!(state.practice.checked || state.practice.passed || state.practice.skipped_dev); }
  function renderPractice(idx) {
    if (LOCAL) { location.hash = started() ? "#/sessions" : "#/consent"; return; } // the researcher's own local evaluation has no practice / comprehension step
    lastStep = "practice"; viewer.hidden = true;
    if (!state.consent_at) { location.hash = "#/consent"; return; }
    const items = practiceItems();
    if (!items.length) {
      main.innerHTML = `<div class="narrow"><div class="panel"><h2>Practice</h2>
        <div class="blocker"><b>Practice material is not configured.</b> The live study cannot start without a practice session and comprehension check.
        If you reached this page from Prolific, please return your submission and message the researcher.</div>
        ${DEV ? '<div class="actions"><button id="btn-skip" class="btn">Skip practice (development preview only)</button></div>' : ""}
      </div></div>`;
      const b = document.getElementById("btn-skip"); if (b) b.addEventListener("click", () => { state.practice.skipped_dev = true; persist(); location.hash = "#/sessions"; });
      renderHeader("practice"); return;
    }
    const i = Math.min(Math.max(idx || 0, 0), items.length - 1);
    const item = items[i];
    const pid = item.id || `practice_${i + 1}`;
    if (!state.practice.marks[pid]) state.practice.marks[pid] = {};
    const result = (state.practice.checked_items || {})[pid] || null; // {answers: [option index per question], correct: [bool per question]}
    if (!activeTarget || activeTarget.key !== pid) setActive("practice", pid);
    const logs = item.logs || [];
    const fakeSession = { session_uid: pid, logs, n_logs: logs.length };
    // An item has either one question (question / options / correct_index) or several (questions: [{question, options, correct_index}]).
    const qs = Array.isArray(item.questions) && item.questions.length ? item.questions
      : [{ question: item.question, options: item.options, correct_index: item.correct_index }];
    const nOk = result ? result.correct.filter(Boolean).length : 0;
    const qHtml = qs.map((q, qi) => {
      const chosen = result ? result.answers[qi] : null;
      const ok = result ? result.correct[qi] : null;
      const opts = (q.options || []).map((o, k) => {
        const intended = !!result && k === Number(q.correct_index);
        const chosenWrong = !!result && k === chosen && !ok;
        const tag = intended ? `<span class="opt-tag ok">${k === chosen ? "✓ your answer (as intended)" : "✓ intended answer"}</span>`
          : chosenWrong ? '<span class="opt-tag ng">✗ your answer</span>' : "";
        return `<label class="${intended ? "opt-correct" : chosenWrong ? "opt-wrong" : ""}"><input type="radio" name="comp-${qi}" value="${k}"${result ? " disabled" : ""}${result && k === chosen ? " checked" : ""}> ${esc(o)}${tag}</label>`;
      }).join("");
      const mark = result ? (ok ? '<span class="q-res ok">✓</span> ' : '<span class="q-res ng">✗</span> ') : "";
      return `<div class="comp-q"><p>${mark}${qs.length > 1 ? `<b>${qi + 1}.</b> ` : ""}${esc(q.question || "")}</p><div class="options">${opts}</div></div>`;
    }).join("");
    const summary = result ? `<div class="${nOk === qs.length ? "success" : "notice"}" id="comp-result" role="status"><b>${nOk} of ${qs.length} answered as intended.</b>
      ${nOk === qs.length ? "" : "The intended answers are shown in green; an answer that differs is shown in red."}
      Please keep these examples in mind in your sessions. The Stage guide (top right) is available at any time.</div>` : "";
    const notice = !result && compNotice && compNotice.pid === pid ? `<div class="blocker" id="comp-feedback" role="alert">${esc(compNotice.text)}</div>` : "";
    const next = result ? (i + 1 < items.length ? `<a class="btn btn-primary" href="#/practice/${i + 1}">Next practice</a>` : '<a class="btn btn-primary" href="#/sessions">Start the sessions</a>') : "";
    const wireComp = () => {
      if (result) return; // answers are locked once checked
      // restore answers chosen before a re-render (marking a practice step re-renders the panel) and remember new ones
      const saved = compAnswers[pid] || {};
      qs.forEach((_, qi) => { const r = document.querySelector(`input[name="comp-${qi}"][value="${saved[qi]}"]`); if (r) r.checked = true; });
      document.querySelectorAll("#comp-panel input[type=radio]").forEach((r) => r.addEventListener("change", () => {
        compAnswers[pid] = { ...(compAnswers[pid] || {}), [Number(r.name.slice(5))]: r.value }; }));
      const chk = document.getElementById("btn-check");
      if (chk) chk.addEventListener("click", () => {
        const sels = qs.map((_, qi) => document.querySelector(`input[name="comp-${qi}"]:checked`));
        if (sels.some((x) => !x)) {
          compNotice = { pid, text: qs.length > 1 ? "Please answer every question first." : "Please choose an answer first." };
          renderPractice(i); showCompPanel(); return;
        }
        const answers = sels.map((x) => Number(x.value));
        const correct = answers.map((k, qi) => k === Number(qs[qi].correct_index));
        state.practice.checked_items = { ...(state.practice.checked_items || {}), [pid]: { answers, correct } };
        state.practice.attempts[pid] = 1;
        stampOnce(TM().practice[pid] ||= {}, "checked_at");
        logEvent("practice_check", { s: "practice", i: i + 1, n_ok: correct.filter(Boolean).length });
        const all = items.map((it, k) => state.practice.checked_items[it.id || `practice_${k + 1}`]);
        if (all.every(Boolean)) { state.practice.checked = true; state.practice.passed = all.every((r) => r.correct.every(Boolean)); stampOnce(TM(), "practice_checked_at"); }
        delete compAnswers[pid]; compNotice = null;
        persist(); renderPractice(i); showCompPanel();
      });
    };
    renderSessionView(fakeSession, {
      onRender: wireComp,
      practice: true, title: `Practice ${i + 1} of ${items.length}: ${esc(item.title || "")}`, intro: item.intro || "",
      marks: state.practice.marks[pid],
      onMarksChange: () => saveState(),
      footer: `<div class="panel" id="comp-panel">
        <h3>Comprehension check</h3>
        ${summary}${notice}
        ${qHtml}
        ${result ? "" : `<p class="muted small">After you check, the intended answers are shown and you continue to your sessions.</p>
          <div class="actions"><button id="btn-check" class="btn btn-primary">Check ${qs.length > 1 ? "answers" : "answer"}</button></div>`}
        <div class="actions">${i > 0 ? `<a class="btn" href="#/practice/${i - 1}">Previous practice</a>` : '<a class="btn" href="#/instructions">Back to instructions</a>'}
          ${next}</div>
      </div>`,
    });
    renderHeader("practice");
  }

  // ---------- assigned sessions list ----------
  function guardSessions() {
    if (!started()) { location.hash = "#/consent"; return false; }
    if (!LOCAL && !practiceDone()) { location.hash = "#/practice"; return false; }
    if (!ASSIGNED.sessions || !ASSIGNED.sessions.length) {
      lastStep = "sessions"; viewer.hidden = true;
      main.innerHTML = `<div class="narrow"><div class="panel"><h2>Your sessions</h2><div class="blocker"><b>No sessions have been assigned to this link.</b> The study cannot continue. Please return your submission on Prolific and message the researcher.</div></div></div>`;
      renderHeader("sessions"); return false;
    }
    return true;
  }
  function renderSessions() {
    lastStep = "sessions"; viewer.hidden = true;
    if (!guardSessions()) return;
    const rows = ASSIGNED.sessions.map((s, i) => {
      const meta = state.sessions[s.session_uid] || {}; const nm = Object.keys(marksOf(s.session_uid)).length;
      const st = meta.completed ? "completed" : nm ? "working" : "todo";
      return `<tr class="row" data-i="${i}" tabindex="0"><td>${i + 1}</td><td>${s.n_logs} steps</td><td>${fmtT(s.duration_s)}</td><td>${nm} change point${nm === 1 ? "" : "s"}</td>
        <td><span class="badge st-${st}">${st === "completed" ? "Completed" : st === "working" ? "In progress" : "Not started"}</span></td><td><a href="#/s/${i + 1}">Open</a></td></tr>`;
    }).join("");
    const allDone = ASSIGNED.sessions.every((s) => state.sessions[s.session_uid]?.completed);
    main.innerHTML = `<div class="narrow"><div class="panel"><h2>Your sessions</h2>
      <p>Work through each session and press <b>Mark this session as complete</b> when done. ${LOCKED() ? '<span class="success">Your results have been submitted; sessions are now read-only.</span>' : ""}</p>
      <table class="list"><thead><tr><th>#</th><th>Length</th><th>Duration</th><th>Your marks</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="actions"><a class="btn" href="${LOCAL ? "#/instructions" : "#/practice"}">${LOCAL ? "Back to instructions" : "Back to practice"}</a>
        ${LOCAL ? '<a class="btn btn-primary" href="#/review">Review and export</a>' : allDone ? '<a class="btn btn-primary" href="#/review">Review and submit</a>' : '<span class="muted">Complete all sessions to continue to the review.</span>'}</div>
    </div></div>`;
    main.querySelectorAll("tr.row").forEach((tr) => { const go = () => { location.hash = "#/s/" + (Number(tr.dataset.i) + 1); }; tr.addEventListener("click", go); tr.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); }); });
    renderHeader("sessions");
  }

  // ---------- session view (shared by practice and assigned sessions) ----------
  let selectedLogId = null, viewerShot = "auto";
  const view = { filter: "all" };
  let current = null; // { s, opts, marks }

  function renderAssigned(n) {
    if (!guardSessions()) return;
    const i = n - 1; const s = ASSIGNED.sessions[i];
    if (!s) { location.hash = "#/sessions"; return; }
    lastStep = "sessions";
    if (!state.marks[s.session_uid]) state.marks[s.session_uid] = {};
    setActive("sessions", s.session_uid);
    renderSessionView(s, {
      practice: false, index: i, total: ASSIGNED.sessions.length, title: `Session ${i + 1} of ${ASSIGNED.sessions.length}`,
      marks: state.marks[s.session_uid], onMarksChange: () => saveState(),
    });
    renderHeader("sessions");
  }

  function renderSessionView(s, opts, keepScroll) {
    const marks = opts.marks;
    current = { s, opts, marks };
    if (!selectedLogId || !s.logs.some((l) => l.log_id === selectedLogId)) selectedLogId = s.logs[0]?.log_id || null;
    const scrollY = keepScroll ? window.scrollY : 0;
    const seg = segmentLabels(s.logs, marks);
    const meta = opts.practice ? {} : (state.sessions[s.session_uid] || {});
    const locked = !opts.practice && LOCKED();
    const nav = opts.practice ? "" : `<div class="actions" style="margin-top:0">
        <a class="btn" href="#/sessions">All sessions</a>
        ${opts.index > 0 ? `<a class="btn" href="#/s/${opts.index}">← Previous session</a>` : ""}
        ${opts.index + 1 < opts.total ? `<a class="btn" href="#/s/${opts.index + 2}">Next session →</a>` : `<a class="btn" href="#/review">Go to review</a>`}</div>`;
    const head = `<div class="sh-row1">
        <div><h2>${opts.title} ${meta.completed ? '<span class="badge st-completed">Completed</span>' : ""}</h2>
          <div class="muted small">${s.logs.length} steps · ${fmtT(s.duration_s || (s.logs.at(-1)?.t_rel_s ?? 0))} · ${Object.keys(marks).length} change point${Object.keys(marks).length === 1 ? "" : "s"}${locked ? " · read-only (submitted)" : ""}</div>
          ${opts.intro ? `<p class="sh-intro">${esc(opts.intro)}</p>` : ""}</div>
        ${nav}</div>
      <div class="sh-row2">
        <span class="muted">Show:</span>
        <button class="btn filter ${view.filter === "all" ? "btn-active" : ""}" data-f="all">All steps</button>
        <button class="btn filter ${view.filter === "marks" ? "btn-active" : ""}" data-f="marks">Change points only</button>
        <span class="muted small sh-tip">Tip: choose the starting stage on step #1, then click the new stage on each step where it changes. Click a row to see the screenshot on the right.</span>
      </div>`;
    const body = [];
    s.logs.forEach((l, i) => {
      const mk = marks[l.log_id];
      const show = view.filter === "marks" ? !!mk : true;
      if (show) {
        const lab = seg[i];
        const btns = LABELS.map((k) => `<button type="button" class="mbtn ${k} ${mk && mk.label === k ? "on" : ""}" data-l="${k}" aria-pressed="${mk && mk.label === k ? "true" : "false"}" ${locked ? "disabled" : ""} title="From step #${l.pos}: ${LABEL_NAME[k]}">${LABEL_NAME[k]}</button>`).join("");
        body.push(`<tr class="step ${l.page_changed ? "page-changed" : ""} ${l.log_id === selectedLogId ? "selected" : ""}" data-log="${l.log_id}" tabindex="0" aria-selected="${l.log_id === selectedLogId}">
          <td class="pos"><b>#${l.pos}</b></td>
          <td class="band ${lab || ""}">${mk ? `${chip(mk.label)}<span class="cp">change point${locked ? "" : ' <button type="button" class="xmark" title="Remove this change point">×</button>'}</span>` : lab ? `<span class="small">${LABEL_NAME[lab]}</span>` : '<span class="unset">Not set</span>'}</td>
          <td class="mark"><div class="markbtns">${btns}</div>${mk && !locked ? `<input class="mark-comment" type="text" placeholder="Note (optional)" value="${esc(mk.comment || "")}" aria-label="Note for this change point">` : mk && mk.comment ? `<div class="small muted">${esc(mk.comment)}</div>` : ""}</td>
        </tr>`);
      }
    });
    shead.innerHTML = head; shead.hidden = false; setTopOffset();
    main.innerHTML = `<table class="steps" aria-label="Steps of this session"><thead><tr><th class="th-pos">Step</th><th class="th-band">Stage</th><th class="th-mark">Change point: from this step the stage is…</th></tr></thead>
      <tbody>${body.join("") || '<tr><td colspan="3" class="empty">No change points yet.</td></tr>'}</tbody></table>
      <div class="kbd-help">Keyboard: <kbd>↑</kbd>/<kbd>↓</kbd> select step · <kbd>1</kbd>–<kbd>${LABELS.length}</kbd> set stage on the selected step (${LABELS.map((k, i) => `${i + 1}=${LABEL_NAME[k]}`).join(", ")}) · <kbd>Delete</kbd> remove its change point · <kbd>Enter</kbd> on the screenshot to enlarge · <kbd>Esc</kbd> close</div>
      ${opts.footer || ""}`;
    shead.querySelectorAll(".filter").forEach((b) => b.addEventListener("click", () => { view.filter = b.dataset.f; logEvent("filter", { s: evSession(), f: view.filter }); renderSessionView(s, opts, true); }));
    main.querySelectorAll("tr.step").forEach((tr) => wireRow(tr));
    renderViewer();
    if (typeof opts.onRender === "function") opts.onRender(); // footer controls are re-created on every render: wire them again
    window.scrollTo(0, scrollY);
  }

  function setMark(logId, label) {
    const { marks, opts } = current;
    const cur = marks[logId] || {};
    marks[logId] = { label, comment: cur.comment || "", updated_at: now() };
    logEvent("mark", { s: evSession(), p: evPos(logId), l: label });
    opts.onMarksChange();
  }
  function removeMark(logId) { delete current.marks[logId]; logEvent("unmark", { s: evSession(), p: evPos(logId) }); current.opts.onMarksChange(); }
  function rerender() { renderSessionView(current.s, current.opts, true); }
  function wireRow(tr) {
    const logId = tr.dataset.log;
    tr.addEventListener("click", (e) => { if (e.target.closest("button, input, a")) return; selectLog(logId); });
    tr.addEventListener("keydown", (e) => { if (e.target !== tr) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectLog(logId); } });
    tr.querySelectorAll(".mbtn").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); if (LOCKED() && !current.opts.practice) return; setMark(logId, b.dataset.l); selectedLogId = logId; rerender(); }));
    const x = tr.querySelector(".xmark"); if (x) x.addEventListener("click", (e) => { e.preventDefault(); removeMark(logId); rerender(); });
    const ci = tr.querySelector(".mark-comment"); if (ci) ci.addEventListener("input", (e) => { const mk = current.marks[logId]; if (mk) { mk.comment = e.target.value; mk.updated_at = now(); current.opts.onMarksChange(); } });
  }
  function selectLog(logId, scrollRow) { // only called for a participant's selection (click, keyboard, Previous / Next)
    selectedLogId = logId; viewerShot = "auto";
    logEvent("select", { s: evSession(), p: evPos(logId) });
    main.querySelectorAll("tr.step.selected").forEach((t) => { t.classList.remove("selected"); t.setAttribute("aria-selected", "false"); });
    const tr = main.querySelector(`tr.step[data-log="${logId}"]`);
    if (tr) { tr.classList.add("selected"); tr.setAttribute("aria-selected", "true"); if (scrollRow) tr.scrollIntoView({ block: "nearest" }); }
    if (!current.opts.practice) { const m = state.sessions[current.s.session_uid] || {}; const pos = current.s.logs.find((l) => l.log_id === logId)?.pos || 0; if ((m.max_pos_viewed || 0) < pos) { state.sessions[current.s.session_uid] = { ...m, max_pos_viewed: pos, updated_at: m.updated_at || now() }; saveState(); } }
    renderViewer();
  }

  function pickScreenshot(logs, i) {
    const l = logs[i]; const hasB = !!l.screenshot, hasA = !!l.screenshot_new_page;
    let want = viewerShot === "auto" ? (hasA ? "after" : "before") : viewerShot;
    if (want === "after" && hasA) return { file: l.screenshot_new_page, kind: "after", fromPos: l.pos, ownBefore: false };
    if (want === "before" && hasB) return { file: l.screenshot, kind: "before", fromPos: l.pos, ownBefore: true };
    if (hasA) return { file: l.screenshot_new_page, kind: "after", fromPos: l.pos, ownBefore: false };
    if (hasB) return { file: l.screenshot, kind: "before", fromPos: l.pos, ownBefore: true };
    for (let j = i - 1; j >= 0; j--) { const f = logs[j].screenshot_new_page || logs[j].screenshot; if (f) return { file: f, kind: "fallback", fromPos: logs[j].pos, ownBefore: false }; }
    return null;
  }

  // Limit the screenshot height so that the whole right column (down to the complete button) fits the viewport without
  // scrolling. Only max-height is set; width/height stay auto, so the aspect ratio and the click-marker geometry are kept.
  function fitShot() {
    const img = document.getElementById("viewer-img"); if (!img || viewer.hidden) return;
    const wrap = img.closest(".shot-wrap"); if (!wrap) return;
    const avail = window.innerHeight - viewer.getBoundingClientRect().top;
    const others = viewer.scrollHeight - wrap.offsetHeight;
    img.style.maxHeight = Math.max(140, Math.floor(avail - others - 4)) + "px";
  }
  function setTopOffset() {
    const tb = document.querySelector(".topbar");
    const topH = tb ? tb.offsetHeight : 0;
    const headH = topH + (shead.hidden ? 0 : shead.offsetHeight);
    document.documentElement.style.setProperty("--top-h", topH + "px");
    document.documentElement.style.setProperty("--head-h", headH + "px");
  }
  setTopOffset();
  window.addEventListener("resize", () => { setTopOffset(); fitShot(); });
  function renderViewer() {
    const { s, opts, marks } = current;
    const vs = viewer.hidden ? 0 : viewer.scrollTop;
    viewer.hidden = false;
    const i = s.logs.findIndex((l) => l.log_id === selectedLogId); const l = s.logs[i];
    if (!l) { viewer.innerHTML = ""; return; }
    const locked = !opts.practice && LOCKED();
    const seg = segmentLabels(s.logs, marks);
    const shot = pickScreenshot(s.logs, i);
    let shotHtml;
    if (!shot) shotHtml = '<div class="noshot-big">No screenshot was recorded for this step or any earlier step.</div>';
    else {
      const marker = (shot.ownBefore && l.mouse && l.window && l.window.w > 0 && l.window.h > 0) ? `<span class="click-marker" style="left:${(100 * l.mouse.x / l.window.w).toFixed(2)}%;top:${(100 * l.mouse.y / l.window.h).toFixed(2)}%" title="Click position"></span>` : "";
      const cap = { before: "Screen before this action", after: "Screen after the navigation", fallback: `Most recent screen (from step #${shot.fromPos}; no screenshot was recorded for this step)` }[shot.kind];
      const tabs = (l.screenshot && l.screenshot_new_page) ? `<div class="shot-tabs"><button class="btn ${shot.kind === "before" ? "btn-active" : ""}" data-shot="before">Before</button><button class="btn ${shot.kind === "after" ? "btn-active" : ""}" data-shot="after">After</button></div>` : "";
      shotHtml = `${tabs}<div class="shot-area"><div class="shot-wrap ${shot.kind}" id="shot-wrap" tabindex="0" role="button" aria-label="Enlarge screenshot"><img id="viewer-img" src="${SHOT_DIR}${esc(shot.file)}" alt="Screenshot for step ${l.pos}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'noshot-big',textContent:'Screenshot image unavailable'}))">${marker}</div></div>
        <div class="shot-caption ${shot.kind}">${cap}${marker ? " · red circle = click position" : ""} · click to enlarge</div>`;
    }
    const sub = l.click_type || l.navigation_type;
    const actText = l.observation && (l.observation.element_text || (l.action_type === "input" ? l.observation.input_text : null));
    const meta = opts.practice ? {} : (state.sessions[s.session_uid] || {});
    const viewedAll = (meta.max_pos_viewed || 0) >= s.logs.length;
    viewer.innerHTML = `
      <div class="viewer-head"><div><b>Step #${l.pos}</b> · +${fmtT(l.t_rel_s)} · stage here: ${chip(seg[i])}</div>
        <div class="viewer-nav"><button class="btn" id="v-prev" ${i === 0 ? "disabled" : ""}>↑ Previous</button><button class="btn" id="v-next" ${i === s.logs.length - 1 ? "disabled" : ""}>Next ↓</button></div></div>
      ${shotHtml}
      <div class="viewer-section"><h4>What happened</h4>
        <dl class="facts">
          <dt>Page</dt><dd>${pageBadge(l.page_kind)} <span class="mono path">${esc(l.url_path)}</span></dd>
          <dt>Action</dt><dd><b>${ACTION_NAME[l.action_type] || esc(l.action_type)}</b>${sub ? ` <span class="muted">(${esc(String(sub).replace(/_/g, " "))})</span>` : ""}${actText ? `<div class="target">“${esc(actText)}”</div>` : ""}</dd>
          ${l.rationale ? `<dt>Rationale</dt><dd class="rat-dd">${esc(l.rationale)}</dd>` : ""}
        </dl></div>
      ${opts.practice ? "" : `<div class="viewer-section">
        <textarea id="sess-comment" class="session-comment" placeholder="Comment on this session (optional)" ${locked ? "disabled" : ""}>${esc(meta.comment || "")}</textarea>
        <div class="actions"><button id="btn-complete" class="btn ${meta.completed ? "btn-done" : "btn-primary"}" ${locked ? "disabled" : ""}>${meta.completed ? "Reopen this session" : "Mark this session as complete"}</button>
          <span class="muted small">${meta.completed ? "Completed." : viewedAll ? "You have viewed every step." : `Steps viewed so far: up to #${meta.max_pos_viewed || 1} of ${s.logs.length}.`}</span></div></div>`}`;
    viewer.scrollTop = vs;
    viewer.querySelectorAll("[data-shot]").forEach((b) => b.addEventListener("click", () => { viewerShot = b.dataset.shot; renderViewer(); }));
    const go = (d) => { const j = i + d; if (j < 0 || j >= s.logs.length) return; selectLog(s.logs[j].log_id, true); };
    document.getElementById("v-prev").addEventListener("click", () => go(-1));
    document.getElementById("v-next").addEventListener("click", () => go(1));
    const vimg = document.getElementById("viewer-img");
    if (vimg) { vimg.addEventListener("load", fitShot); requestAnimationFrame(fitShot); }
    const sw = document.getElementById("shot-wrap");
    if (sw) { const open = () => { logEvent("zoom", { s: evSession(), p: l.pos }); openLightbox(sw.querySelector("img")?.src); }; sw.addEventListener("click", open); sw.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }); }
    const sc = document.getElementById("sess-comment");
    if (sc) sc.addEventListener("input", (e) => { const m = state.sessions[s.session_uid] || {}; state.sessions[s.session_uid] = { ...m, comment: e.target.value, updated_at: now() }; saveState(); });
    const bc = document.getElementById("btn-complete");
    if (bc) bc.addEventListener("click", () => {
      const m = state.sessions[s.session_uid] || {};
      if (!m.completed) {
        if (!marks[s.logs[0].log_id]) { toast("Please choose the starting stage on step #1 before completing this session."); return; }
        const va = (m.max_pos_viewed || 0) >= s.logs.length;
        if (!va && !confirm(`You have viewed steps up to #${m.max_pos_viewed || 1} of ${s.logs.length}. Mark this session as complete anyway?`)) return;
        state.sessions[s.session_uid] = { ...m, completed: true, updated_at: now() };
        stampOnce(TM().sessions[s.session_uid] ||= {}, "completed_at");
        logEvent("complete", { s: evSession() });
      } else { state.sessions[s.session_uid] = { ...m, completed: false, updated_at: now() }; logEvent("uncomplete", { s: evSession() }); }
      persist(); rerender(); renderHeader("sessions");
    });
  }

  // ---------- lightbox ----------
  const lb = document.getElementById("lightbox"), lbImg = document.getElementById("lightbox-img");
  function openLightbox(src) { if (!src) return; lbImg.src = src; lb.hidden = false; document.getElementById("lightbox-close").focus(); }
  function closeLightbox() { lb.hidden = true; lbImg.removeAttribute("src"); document.getElementById("shot-wrap")?.focus(); }
  document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target === lbImg) closeLightbox(); });

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!lb.hidden) { closeLightbox(); return; } const g = document.getElementById("guide"); if (!g.hidden) toggleGuide(); return; }
    if (!current || viewer.hidden) return;
    const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const { s, opts } = current; const i = s.logs.findIndex((l) => l.log_id === selectedLogId); if (i < 0) return;
    if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); if (i + 1 < s.logs.length) selectLog(s.logs[i + 1].log_id, true); }
    else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); if (i > 0) selectLog(s.logs[i - 1].log_id, true); }
    else if (/^[1-9]$/.test(e.key) && Number(e.key) <= LABELS.length) { if (!opts.practice && LOCKED()) return; e.preventDefault(); setMark(selectedLogId, LABELS[Number(e.key) - 1]); rerender(); }
    else if (e.key === "Delete" || e.key === "Backspace") { if (!opts.practice && LOCKED()) return; if (current.marks[selectedLogId]) { e.preventDefault(); removeMark(selectedLogId); rerender(); } }
  });

  // ---------- review ----------
  function renderReview() {
    lastStep = "review"; viewer.hidden = true;
    if (!guardSessions()) return;
    if (!LOCKED()) stampOnce(TM(), "review_opened_at");
    const rows = ASSIGNED.sessions.map((s, i) => {
      const m = state.sessions[s.session_uid] || {}; const marks = marksOf(s.session_uid);
      const first = !!marks[s.logs[0].log_id]; const viewed = (m.max_pos_viewed || 0) >= s.logs.length;
      return `<tr><td>${i + 1}</td><td>${s.logs.length}</td><td>${Object.keys(marks).length}</td>
        <td class="${first ? "ok" : "ng"}">${first ? "Yes" : "No"}</td><td class="${viewed ? "ok" : ""}">${viewed ? "All steps" : `Up to #${m.max_pos_viewed || 1}`}</td>
        <td class="${m.completed ? "ok" : "ng"}">${m.completed ? "Completed" : "Not completed"}</td><td><a href="#/s/${i + 1}">${LOCKED() ? "View" : "Edit"}</a></td></tr>`;
    }).join("");
    const allOk = ASSIGNED.sessions.every((s) => state.sessions[s.session_uid]?.completed && marksOf(s.session_uid)[s.logs[0].log_id]);
    if (LOCAL) {
      const nDone = ASSIGNED.sessions.filter((x) => state.sessions[x.session_uid]?.completed).length;
      main.innerHTML = `<div class="narrow"><div class="panel"><h2>Review and export</h2>
        <p>Completed sessions: <b>${nDone} / ${ASSIGNED.sessions.length}</b>. A session with no stage change needs only the starting stage on step #1. You can export at any time;
        the export contains the raw change points (with session / step identifiers) plus completion and comments, and no model labels.</p>
        <table class="review"><thead><tr><th>Session</th><th>Steps</th><th>Change points</th><th>Start stage set</th><th>Steps viewed</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        ${allOk ? '<div class="success">All sessions are completed with a starting stage. You can export the final results.</div>' : '<div class="notice">Some sessions are not completed yet. You can still export the current progress.</div>'}
        <div class="actions"><a class="btn" href="#/sessions">Back to sessions</a>
          <button id="btn-export-progress" class="btn ${allOk ? "" : "btn-primary"}">Export progress (JSON)</button>
          ${allOk ? '<button id="btn-export-final" class="btn btn-primary">Export final results (JSON)</button>' : ""}
          <button id="btn-import-review" class="btn">Import progress…</button></div>
        <p class="muted small">${state.last_export_at ? `Last export: ${esc(new Date(state.last_export_at).toLocaleString())}.` : "Not exported yet."} Browser storage is not a permanent backup; keep the exported files.
          Compare with the model labels afterwards using <span class="mono">compare_human_to_model.py</span> (outside this page).</p>
      </div></div>`;
      document.getElementById("btn-export-progress").addEventListener("click", () => exportLocal(false));
      const bf = document.getElementById("btn-export-final"); if (bf) bf.addEventListener("click", () => exportLocal(true));
      document.getElementById("btn-import-review").addEventListener("click", () => document.getElementById("file-import").click());
      renderHeader("review"); return;
    }
    main.innerHTML = `<div class="narrow"><div class="panel"><h2>Review</h2>
      <p>Check that every session is completed and has a starting stage on step #1. A session with no stage change needs only the starting stage. You can still go back and edit until you submit.</p>
      <table class="review"><thead><tr><th>Session</th><th>Steps</th><th>Change points</th><th>Start stage set</th><th>Steps viewed</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      ${allOk ? "" : '<div class="blocker">Some sessions are not completed or have no starting stage. Please finish them before submitting.</div>'}
      <div class="actions"><a class="btn" href="#/sessions">Back to sessions</a>
        ${LOCKED() ? '<a class="btn btn-primary" href="#/receipt">Go to the completion step</a>' : `<button id="btn-to-submit" class="btn btn-primary" ${allOk ? "" : "disabled"}>Continue to submit</button>`}</div>
    </div></div>`;
    const b = document.getElementById("btn-to-submit"); if (b) b.addEventListener("click", () => { state.review_confirmed = true; persist(); location.hash = "#/submit"; });
    renderHeader("review");
  }

  // ---------- submission ----------
  function buildPayload() {
    const p = {
      schema: "aisas_transitions_v2", codebook_version: CODEBOOK_VERSION, label_order: LABELS, study_id: CFG.study_id, allocation_token: allocToken, idempotency_key: allocToken,
      consent_at: state.consent_at, practice: { passed: state.practice.passed, attempts: state.practice.attempts, skipped_dev: state.practice.skipped_dev },
      sessions: ASSIGNED.sessions.map((s) => {
        const m = state.sessions[s.session_uid] || {}; const marks = marksOf(s.session_uid);
        return { session_uid: s.session_uid, completed: !!m.completed, comment: m.comment || "", max_pos_viewed: m.max_pos_viewed || 0,
          transitions: s.logs.filter((l) => marks[l.log_id]).map((l) => ({ log_id: l.log_id, action_id: l.action_id, pos: l.pos, label: marks[l.log_id].label, comment: marks[l.log_id].comment || "", updated_at: marks[l.log_id].updated_at })) };
      }),
      timing: buildTiming(),
      client: { user_agent: navigator.userAgent, viewport: { w: window.innerWidth, h: window.innerHeight }, dev_preview: DEV },
      submitted_at: now(),
    };
    if (CFG.ids && CFG.ids.include_prolific_url_params === true) p.prolific = { PROLIFIC_PID: params.get("PROLIFIC_PID"), STUDY_ID: params.get("STUDY_ID"), SESSION_ID: params.get("SESSION_ID") };
    return p;
  }
  // Completion info returned by the endpoint on success ({code} or {url}). Only a non-empty code string and an https URL
  // (http only for localhost tests) are accepted; anything else is ignored and the config value (if any) is used instead.
  function endpointCompletion(c) {
    if (!c || typeof c !== "object") return null;
    const out = {};
    if (typeof c.code === "string" && c.code.trim()) out.code = c.code.trim().slice(0, 64);
    if (typeof c.url === "string") {
      try { const u = new URL(c.url); if (u.protocol === "https:" || (u.protocol === "http:" && ["127.0.0.1", "localhost"].includes(u.hostname))) out.url = u.href; } catch { /* ignore invalid URL */ }
    }
    return out.code || out.url ? out : null;
  }
  async function postOnce(url, body, timeoutMs) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": body.idempotency_key }, body: JSON.stringify(body), signal: ctl.signal, mode: "cors" });
      let json = null; try { json = await res.json(); } catch { json = null; }
      return { res, json };
    } finally { clearTimeout(t); }
  }
  async function submit() {
    const ep = CFG.endpoint || {};
    const status = document.getElementById("submit-status");
    if (!ep.url) { status.innerHTML = '<div class="error"><b>The result endpoint is not configured.</b> Your work is saved in this browser, but it cannot be sent. Please message the researcher on Prolific and do not close this browser.</div>'; return; }
    const payload = buildPayload(); // built once per press of "Send": the retries below send exactly this payload
    const maxRetries = Number.isInteger(ep.max_retries) ? ep.max_retries : 2; const timeoutMs = ep.timeout_ms || 20000;
    document.getElementById("btn-submit").disabled = true;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      state.submission.attempts++; persist();
      status.innerHTML = `<div class="notice">Sending your results… (attempt ${attempt + 1} of ${maxRetries + 1})</div>`;
      try {
        const { res, json } = await postOnce(ep.url, payload, timeoutMs);
        if (res.ok && json && json.ok === true) {
          state.submission = { ...state.submission, status: "submitted", submitted_at: now(), receipt: json.receipt_id || json.receipt || null, last_error: null,
            completion: endpointCompletion(json.completion) }; persist();
          location.hash = "#/receipt"; return;
        }
        // The timing record must never block a submission: if the endpoint rejects only `timing` (e.g. a Worker deployed
        // before 2026-10-21, which refuses unknown fields), send the same payload once more without it.
        if (res.status === 400 && payload.timing && json && json.error === "invalid_payload" && Array.isArray(json.problems)
          && json.problems.length && json.problems.every((x) => /\btiming\b/.test(String(x)))) {
          console.warn("the endpoint did not accept the timing record; sending without it", json.problems);
          delete payload.timing; attempt--; continue;
        }
        const msg = `The server did not confirm receipt (HTTP ${res.status}${json ? ", response: " + esc(JSON.stringify(json)).slice(0, 200) : ""}).`;
        state.submission.last_error = msg;
        if (res.status >= 400 && res.status < 500) { fail(msg, false); return; }
        if (attempt === maxRetries) { fail(msg, true); return; }
      } catch (e) {
        const msg = e.name === "AbortError" ? `The request timed out after ${Math.round(timeoutMs / 1000)} seconds.` : `The request could not be sent (${esc(e.message)}). This can be a network problem or a server configuration (CORS) problem.`;
        state.submission.last_error = msg;
        if (attempt === maxRetries) { fail(msg, true); return; }
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
    function fail(msg, retried) {
      persist();
      status.innerHTML = `<div class="error"><b>Your results were not received.</b> ${msg}${retried ? " We tried several times." : ""}<br>
        Your work is still saved in this browser. Please try again in a moment. If it keeps failing, message the researcher on Prolific and keep this browser open. No completion code is available until the results are received.</div>`;
      document.getElementById("btn-submit").disabled = false;
    }
  }
  function renderSubmit() {
    lastStep = "submit"; viewer.hidden = true;
    if (!guardSessions()) return;
    if (LOCKED()) { location.hash = "#/receipt"; return; }
    if (!state.review_confirmed) { location.hash = "#/review"; return; }
    stampOnce(TM(), "submit_opened_at"); persist();
    const ep = CFG.endpoint || {};
    const n = ASSIGNED.sessions.length; const nm = ASSIGNED.sessions.reduce((a, s) => a + Object.keys(marksOf(s.session_uid)).length, 0);
    main.innerHTML = `<div class="narrow"><div class="panel"><h2>Submit your results</h2>
      <p>You are about to send ${nm} change point${nm === 1 ? "" : "s"} for ${n} session${n === 1 ? "" : "s"}. After a successful submission the sessions become read-only and the completion step is shown.</p>
      ${ep.url ? "" : '<div class="blocker"><b>The result endpoint is not configured by the research team.</b> Submission is not possible on this link. Please message the researcher on Prolific.</div>'}
      ${DEV ? '<div class="notice">Development preview: the request is sent to the configured endpoint if any; no success is simulated.</div>' : ""}
      <div id="submit-status">${state.submission.last_error ? `<div class="error">Last attempt failed: ${state.submission.last_error}</div>` : ""}</div>
      <div class="actions"><a class="btn" href="#/review">Back to review</a><button id="btn-submit" class="btn btn-primary" ${ep.url ? "" : "disabled"}>Send my results</button></div>
    </div></div>`;
    document.getElementById("btn-submit").addEventListener("click", submit);
    renderHeader("submit");
  }

  // ---------- receipt / debrief ----------
  function renderReceipt() {
    lastStep = "submit"; viewer.hidden = true;
    if (!LOCKED()) { location.hash = state.review_confirmed ? "#/submit" : "#/review"; return; }
    // the endpoint's completion (received with the successful submission) takes precedence over the config value
    const ec = state.submission.completion; const cc = CFG.completion || {};
    const c = ec && (ec.url || ec.code) ? ec : { url: cc.url || null, code: cc.code || null }; const st = CFG.study || {};
    let completion;
    if (c.url) completion = `<div class="success"><b>Your results have been received.</b> Click the button below to return to Prolific and complete your submission.</div>
      <div class="actions"><a id="btn-return" class="btn btn-primary" href="${esc(c.url)}">Return to Prolific</a><span class="muted small" id="redirect-note"></span></div>`;
    else if (c.code) completion = `<div class="success"><b>Your results have been received.</b> Copy this completion code and enter it on Prolific:</div><p><span class="code-box">${esc(c.code)}</span></p>`;
    else completion = `<div class="error"><b>Your results have been received, but the completion step has not been set up by the research team.</b> No completion code is available on this page. Please message the researcher on Prolific and mention that your results were received${state.submission.receipt ? ` (receipt ${esc(state.submission.receipt)})` : ""}.</div>`;
    main.innerHTML = `<div class="narrow"><div class="panel"><h2>Thank you</h2>${completion}
      ${state.submission.receipt ? `<p class="muted small">Receipt: <span class="mono">${esc(state.submission.receipt)}</span></p>` : ""}
      <h3>About this study</h3>
      <p>This study looks at how the stages of a shopping journey can be identified from recorded browsing behaviour. Your change points will be used as human judgements of when each stage begins in a session.</p>
      <p>${cfgText(st.data_sharing, "publication / sharing of anonymised markings")}</p>
      <h3>Questions</h3><p>${cfgText(st.contact, "contact")}</p>
    </div></div>`;
    if (c.url) { let n = 8; const note = document.getElementById("redirect-note"); const tick = () => { note.textContent = `Redirecting automatically in ${n} s…`; if (n-- <= 0) { location.href = c.url; return; } setTimeout(tick, 1000); }; tick(); }
    renderHeader("submit");
  }

  // ---------- stage guide ----------
  function renderGuide() {
    const cb = CODEBOOK; const list = (a) => a && a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
    let h = `<div class="guide-head"><h3>Stage guide</h3><button class="btn" id="guide-close">Close</button></div>${list(cb.domain_notes)}`;
    for (const k of LABELS) { const d = cb.labels[k]; if (!d) continue; h += `<h4>${chip(k)}</h4><p>${esc(d.definition)}</p>${d.hard_requirement ? `<p class="hard">${esc(d.hard_requirement)}</p>` : ""}<div class="lbl">Examples</div>${list(d.positive_examples)}${d.negative_examples && d.negative_examples.length ? `<div class="lbl">Not this stage</div>${list(d.negative_examples)}` : ""}<div class="lbl">Typical signals</div>${list(d.typical_signals)}`; }
    h += `<h4>When in doubt</h4>${list(cb.tie_break_rules)}`;
    const g = document.getElementById("guide"); g.innerHTML = h; g.querySelector("#guide-close").addEventListener("click", toggleGuide);
  }
  function toggleGuide() { const g = document.getElementById("guide"); g.hidden = !g.hidden; logEvent(g.hidden ? "guide_close" : "guide_open"); const b = document.getElementById("btn-guide"); b.classList.toggle("btn-active", !g.hidden); b.setAttribute("aria-expanded", String(!g.hidden)); }
  document.getElementById("btn-guide").addEventListener("click", toggleGuide);

  // ---------- LOCAL EVALUATION: export / import (never used in the Prolific flow) ----------
  function buildLocalExport(final) {
    return {
      schema: "aisas_local_eval_export_v1", codebook_version: CODEBOOK_VERSION, mode: "local", exported_at: now(), final: !!final,
      bundle: { fingerprint: BUNDLE_FP, session_scope: DATA.meta.session_scope || null, n_sessions: DATA.sessions.length, n_logs: DATA.meta.n_logs, built_at: DATA.meta.built_at || null },
      label_order: LABELS,
      counts: { sessions_total: ASSIGNED.sessions.length, sessions_completed: ASSIGNED.sessions.filter((x) => state.sessions[x.session_uid]?.completed).length,
                sessions_with_marks: ASSIGNED.sessions.filter((x) => Object.keys(marksOf(x.session_uid)).length).length,
                transitions: ASSIGNED.sessions.reduce((a, x) => a + Object.keys(marksOf(x.session_uid)).length, 0) },
      sessions: ASSIGNED.sessions.map((x) => {
        const m = state.sessions[x.session_uid] || {}; const marks = marksOf(x.session_uid);
        return { session_uid: x.session_uid, n_logs: x.logs.length, completed: !!m.completed, comment: m.comment || "", max_pos_viewed: m.max_pos_viewed || 0,
          transitions: x.logs.filter((l) => marks[l.log_id]).map((l) => ({ log_id: l.log_id, action_id: l.action_id, pos: l.pos, label: marks[l.log_id].label, comment: marks[l.log_id].comment || "", updated_at: marks[l.log_id].updated_at })) };
      }),
      timing: buildTiming(), // the same shape as in the Prolific payload; consent_at there = started_at here
      started_at: state.local_started_at || null,
    };
  }
  function exportLocal(final) {
    const data = buildLocalExport(final);
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); const ts = data.exported_at.replace(/[:.]/g, "-").slice(0, 19);
    a.href = URL.createObjectURL(blob); a.download = `aisas_local_eval_${final ? "final" : "progress"}_${ts}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    state.last_export_at = data.exported_at; persist(); renderHeader();
    toast(`Exported ${data.counts.transitions} change point${data.counts.transitions === 1 ? "" : "s"} from ${data.counts.sessions_with_marks} session${data.counts.sessions_with_marks === 1 ? "" : "s"}.`);
  }
  function importLocal(text) {
    let d; try { d = JSON.parse(text); } catch { toast("Import failed: the file is not valid JSON."); return; }
    if (!d || d.schema !== "aisas_local_eval_export_v1" || !Array.isArray(d.sessions)) { toast("Import failed: not an aisas_local_eval_export_v1 file."); return; }
    // exports without codebook_version were made with the old 6-label codebook v001; never reinterpret their labels
    const fileCb = d.codebook_version || "v001";
    if (fileCb !== CODEBOOK_VERSION) { toast(`Import failed: the file uses stage definitions ${fileCb}, this page uses ${CODEBOOK_VERSION}. Labels are not converted between versions.`); return; }
    const problems = []; const incoming = [];
    for (const s of d.sessions) {
      const sess = SESSION_BY_UID.get(s.session_uid);
      if (!sess) { problems.push(`unknown session ${s.session_uid}`); continue; }
      const byId = new Map(sess.logs.map((l) => [l.log_id, l]));
      const marks = {};
      for (const t of (s.transitions || [])) {
        const l = byId.get(t.log_id);
        if (!l) { problems.push(`session ${s.session_uid}: unknown step ${t.log_id}`); continue; }
        if (!LABELS.includes(t.label)) { problems.push(`session ${s.session_uid}: unknown label ${t.label}`); continue; }
        marks[l.log_id] = { label: t.label, comment: typeof t.comment === "string" ? t.comment : "", updated_at: t.updated_at || now() };
      }
      if (!Object.keys(marks).length && !s.completed && !(typeof s.comment === "string" && s.comment.trim())) continue; // nothing recorded for this session in the file
      incoming.push({ uid: s.session_uid, marks, meta: { completed: !!s.completed, comment: typeof s.comment === "string" ? s.comment : "", max_pos_viewed: Number(s.max_pos_viewed) || 0, updated_at: now() } });
    }
    if (!incoming.length) { toast("Import failed: no usable sessions in the file." + (problems.length ? ` (${problems[0]})` : "")); return; }
    const fpNote = d.bundle && d.bundle.fingerprint && d.bundle.fingerprint !== BUNDLE_FP ? "\nWARNING: the file was exported from a different bundle (fingerprint mismatch); only sessions and steps that exist here were kept." : "";
    const msg = `Import ${incoming.length} session(s) from the file?\n\nFor each session that has change points, a comment or a completion flag in the file, its change points, comment and completion will REPLACE what you have here. Other sessions are left unchanged.${problems.length ? `\n${problems.length} entr${problems.length === 1 ? "y was" : "ies were"} skipped (e.g. ${problems[0]}).` : ""}${fpNote}`;
    if (!confirm(msg)) return;
    for (const it of incoming) { state.marks[it.uid] = it.marks; state.sessions[it.uid] = it.meta; }
    persist(); toast(`Imported ${incoming.length} session(s).`); route();
  }
  if (LOCAL) {
    document.getElementById("btn-export").addEventListener("click", () => exportLocal(false));
    document.getElementById("btn-import").addEventListener("click", () => document.getElementById("file-import").click());
    document.getElementById("file-import").addEventListener("change", (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => importLocal(String(rd.result)); rd.readAsText(f, "utf-8"); e.target.value = ""; });
  }

  // ---------- routing ----------
  function routeEvent(h) {
    let m;
    // numbers only when they exist (a hand-typed #/s/99 is recorded as a route without a session number)
    const nS = ASSIGNED.sessions ? ASSIGNED.sessions.length : 0, nP = Math.min(practiceItems().length, 50);
    if ((m = h.match(/^#\/s\/(\d+)$/))) { const n = Number(m[1]); return n >= 1 && n <= nS ? { r: "s", s: n } : { r: "s" }; }
    if ((m = h.match(/^#\/practice(?:\/(\d+))?$/))) { const n = (m[1] ? Number(m[1]) : 0) + 1; return n <= nP ? { r: "practice", i: n } : { r: "practice" }; }
    const r = { "#/instructions": "instructions", "#/sessions": "sessions", "#/review": "review", "#/submit": "submit" }[h];
    return r ? { r } : ["#/consent", "#/", "#", ""].includes(h) ? { r: "consent" } : null;
  }
  function route() {
    shead.hidden = true; setTopOffset();
    const h = location.hash || "#/consent";
    setActive(null); current = null;
    const ev = routeEvent(h); if (ev) logEvent("route", ev);
    let m;
    if (h === "#/consent" || h === "#/" || h === "#") renderConsent();
    else if (h === "#/instructions") renderInstructions();
    else if ((m = h.match(/^#\/practice(?:\/(\d+))?$/))) renderPractice(m[1] ? Number(m[1]) : 0);
    else if (h === "#/sessions") renderSessions();
    else if ((m = h.match(/^#\/s\/(\d+)$/))) { selectedLogId = null; viewerShot = "auto"; view.filter = "all"; renderAssigned(Number(m[1])); }
    else if (h === "#/review") renderReview();
    else if (h === "#/submit") { if (LOCAL) { location.hash = "#/review"; return; } renderSubmit(); }
    else if (h === "#/receipt") { if (LOCAL) { location.hash = "#/review"; return; } renderReceipt(); }
    else renderConsent();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  renderGuide();
  route();
})();
