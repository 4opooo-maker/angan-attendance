(() => {
  const $ = (id) => document.getElementById(id);
  const screens = ["welcomeScreen", "idScreen", "cameraScreen", "successScreen"];
  const state = { studentId: "", stream: null, photoDataUrl: "", submitted: false };
  $("year").textContent = new Date().getFullYear();

  function showScreen(id) {
    screens.forEach(s => $(s).classList.toggle("active", s === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showToast(message) {
    const t = $("toast"); t.textContent = message; t.classList.add("show");
    clearTimeout(showToast.timer); showToast.timer = setTimeout(() => t.classList.remove("show"), 3300);
  }
  function nowParts() {
    const d = new Date();
    return {
      date: d.toLocaleDateString("en-CA"),
      time: d.toLocaleTimeString("en-GB", { hour12: false }),
      displayDate: d.toLocaleDateString("hi-IN", { day:"2-digit", month:"long", year:"numeric" }),
      displayTime: d.toLocaleTimeString("hi-IN", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true }),
      timestamp: d.toISOString()
    };
  }
  function updateClock() {
    const n = nowParts();
    $("todayDate").textContent = n.displayDate;
    $("currentTime").textContent = n.displayTime;
  }
  setInterval(updateClock, 1000); updateClock();

  $("startBtn").addEventListener("click", () => showScreen("idScreen"));
  document.querySelectorAll("[data-back]").forEach(btn => btn.addEventListener("click", async () => {
    if (btn.dataset.back === "idScreen") await stopCamera();
    showScreen(btn.dataset.back);
  }));

  $("studentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("studentId").value.trim();
    $("idError").textContent = "";
    if (!id) { $("idError").textContent = "कृपया Student ID दर्ज करें।"; return; }
    state.studentId = id;
    $("shownStudentId").textContent = id;
    $("cameraMessage").textContent = "कैमरा अनुमति माँग सकता है।";
    $("cameraPlaceholder").hidden = false;
    $("cameraVideo").hidden = true;
    $("photoPreview").hidden = true;
    $("captureBtn").disabled = true;
    $("submitBtn").disabled = true;
    $("retakeBtn").hidden = true;
    state.photoDataUrl = ""; state.submitted = false;
    showScreen("cameraScreen");
  });

  $("startCameraBtn").addEventListener("click", startCamera);
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("कैमरा के लिए HTTPS वेबसाइट या आधुनिक ब्राउज़र आवश्यक है।");
      $("cameraMessage").textContent = "कैमरा उपलब्ध नहीं है। वेबसाइट HTTPS पर खोलें।";
      return;
    }
    try {
      await stopCamera();
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }
      });
      $("cameraVideo").srcObject = state.stream;
      $("cameraVideo").hidden = false;
      $("photoPreview").hidden = true;
      $("cameraPlaceholder").hidden = true;
      $("captureBtn").disabled = false;
      $("cameraMessage").textContent = "चेहरा फ्रेम में रखें और Selfie लें।";
      $("startCameraBtn").textContent = "कैमरा दोबारा शुरू करें";
    } catch (err) {
      console.error(err);
      $("cameraMessage").textContent = "कैमरा नहीं खुल सका। Browser permission जाँचें।";
      showToast("कैमरा अनुमति दें और फिर प्रयास करें।");
    }
  }
  async function stopCamera() {
    if (state.stream) state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
    $("cameraVideo").srcObject = null;
  }

  $("captureBtn").addEventListener("click", () => {
    const video = $("cameraVideo");
    if (!video.videoWidth) { showToast("कैमरा तैयार होने तक प्रतीक्षा करें।"); return; }
    const canvas = $("photoCanvas");
    const maxWidth = 900;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    // Mirror the front-camera preview so the saved selfie looks natural.
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    state.photoDataUrl = canvas.toDataURL("image/jpeg", 0.78);
    $("photoPreview").src = state.photoDataUrl;
    $("photoPreview").hidden = false;
    $("cameraVideo").hidden = true;
    $("cameraPlaceholder").hidden = true;
    $("captureBtn").disabled = true;
    $("retakeBtn").hidden = false;
    $("submitBtn").disabled = false;
    $("cameraMessage").textContent = "Selfie तैयार है। सबमिट करने से पहले जाँच लें।";
    stopCamera();
  });

  $("retakeBtn").addEventListener("click", async () => {
    state.photoDataUrl = "";
    $("photoPreview").hidden = true;
    $("cameraPlaceholder").hidden = false;
    $("captureBtn").disabled = true;
    $("submitBtn").disabled = true;
    $("retakeBtn").hidden = true;
    await startCamera();
  });

  $("submitBtn").addEventListener("click", submitAttendance);
  async function submitAttendance() {
    if (!state.studentId || !state.photoDataUrl || state.submitted) return;
    const n = nowParts();
    const record = {
      studentId: state.studentId,
      attendanceDate: n.date,
      attendanceTime: n.time,
      attendanceStatus: "Present",
      submissionTimestamp: n.timestamp,
      selfieDataUrl: state.photoDataUrl,
      userAgent: navigator.userAgent
    };
    const btn = $("submitBtn");
    btn.disabled = true; btn.textContent = "सबमिट हो रहा है…";
    try {
      const cfg = window.ANGAN_CONFIG || {};
      if (cfg.ENABLE_SHEETS_SUBMISSION && cfg.APPS_SCRIPT_URL) {
        const response = await fetch(cfg.APPS_SCRIPT_URL, {
          method: "POST",
          // text/plain avoids a preflight request for Apps Script web apps.
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(record),
          redirect: "follow"
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || "Submission failed");
        state.submissionId = result.submissionId || "Recorded";
        state.studentName = result.studentName || "";
      } else {
        // Local preview mode is for testing the screens only; it does not save to Sheets.
        state.submissionId = "TEST-" + Date.now().toString().slice(-8);
        showToast("Preview mode: रिकॉर्ड Google Sheets में सेव नहीं हुआ।");
      }
      state.submitted = true;
      $("successId").textContent = state.studentId;
      $("successDate").textContent = n.displayDate;
      $("successTime").textContent = n.displayTime;
      $("submissionId").textContent = state.submissionId || "—";
      await stopCamera();
      showScreen("successScreen");
    } catch (err) {
      console.error(err);
      // Show the actual message returned by Apps Script (for example, duplicate attendance)
      // instead of always displaying a misleading internet/Sheets error.
      const errorMessage = (err && err.message && err.message !== "Submission failed")
        ? err.message
        : "सबमिट नहीं हुआ। इंटरनेट कनेक्शन और Google Sheets सेटअप जाँचें।";
      showToast(errorMessage);
      $("cameraMessage").textContent = errorMessage;
      btn.disabled = false;
    } finally {
      btn.textContent = "Attendance Submit करें";
    }
  }

  $("newAttendanceBtn").addEventListener("click", async () => {
    await stopCamera();
    state.studentId = ""; state.photoDataUrl = ""; state.submitted = false;
    $("studentId").value = "";
    showScreen("welcomeScreen");
  });

  window.addEventListener("beforeunload", stopCamera);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
})();
