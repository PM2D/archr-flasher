// Arch R Flasher — Frontend Logic
// Tauri 2 IPC: all backend calls go through invoke()

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
let lang = {};
const SUPPORTED_LOCALES = ['en', 'pt-BR'];

async function initI18n() {
  try {
    const osLocale = await window.__TAURI__.core.invoke('get_locale');
    // Match: "pt-BR" → "pt-BR", "pt_BR" → "pt-BR", "pt" → "pt-BR", "en-US" → "en"
    const normalized = osLocale.replace('_', '-');
    let locale = SUPPORTED_LOCALES.find(l => normalized.startsWith(l));
    if (!locale) {
      // Try matching just the language part (e.g. "pt" from "pt-PT")
      const langPart = normalized.split('-')[0];
      locale = SUPPORTED_LOCALES.find(l => l.startsWith(langPart)) || 'en';
    }

    const resp = await fetch(`../assets/i18n/${locale}.json`);
    lang = await resp.json();
  } catch (e) {
    // Fallback: load English
    try {
      const resp = await fetch('../assets/i18n/en.json');
      lang = await resp.json();
    } catch (_) {
      lang = {};
    }
  }

  applyI18n();
}

function t(key, replacements) {
  let text = lang[key] || key;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (lang[key]) el.textContent = lang[key];
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (lang[key]) el.title = lang[key];
  });
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let selectedConsole = null;
let selectedPanel = null;
let selectedDisk = null;
let imagePath = null;

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const btnOriginal = $('btn-original');
const btnClone = $('btn-clone');
const panelSection = $('panel-section');
const panelSelect = $('panel-select');
const diskSection = $('disk-section');
const diskSelect = $('disk-select');
const flashSection = $('flash-section');
const btnFlash = $('btn-flash');
const progressSection = $('progress-section');
const progressFill = $('progress-fill');
const progressPercent = $('progress-percent');
const progressStage = $('progress-stage');
const statusEl = $('status');
const imageNameEl = $('image-name');
const imageVersionEl = $('image-version');
const confirmDialog = $('confirm-dialog');
const confirmText = $('confirm-text');

// ---------------------------------------------------------------------------
// Console selection
// ---------------------------------------------------------------------------
function selectConsole(console) {
  selectedConsole = console;
  selectedPanel = null;

  btnOriginal.classList.toggle('active', console === 'original');
  btnClone.classList.toggle('active', console === 'clone');

  loadPanels(console);
  panelSection.style.display = '';
  diskSection.style.display = 'none';
  flashSection.style.display = 'none';
  updateFlashButton();
}

btnOriginal.addEventListener('click', () => selectConsole('original'));
btnClone.addEventListener('click', () => selectConsole('clone'));

// ---------------------------------------------------------------------------
// Panel loading
// ---------------------------------------------------------------------------
async function loadPanels(console) {
  const panels = await window.__TAURI__.core.invoke('get_panels', { console });

  panelSelect.innerHTML = `<option value="">${t('select_panel')}</option>`;

  panels.forEach(panel => {
    const opt = document.createElement('option');
    opt.value = JSON.stringify({ id: panel.id, dtb: panel.dtb });
    const suffix = panel.is_default ? ` (${t('recommended')})` : '';
    opt.textContent = panel.name + suffix;
    if (panel.is_default) opt.selected = true;
    panelSelect.appendChild(opt);
  });

  // Auto-select default
  const defaultPanel = panels.find(p => p.is_default);
  if (defaultPanel) {
    selectedPanel = defaultPanel;
    panelSelect.value = JSON.stringify({ id: defaultPanel.id, dtb: defaultPanel.dtb });
    onPanelSelected();
  }
}

panelSelect.addEventListener('change', () => {
  if (panelSelect.value) {
    selectedPanel = JSON.parse(panelSelect.value);
    onPanelSelected();
  } else {
    selectedPanel = null;
    diskSection.style.display = 'none';
    flashSection.style.display = 'none';
  }
  updateFlashButton();
});

function onPanelSelected() {
  diskSection.style.display = '';
  flashSection.style.display = '';
  refreshDisks();
}

// ---------------------------------------------------------------------------
// Disk listing
// ---------------------------------------------------------------------------
async function refreshDisks() {
  const disks = await window.__TAURI__.core.invoke('list_disks');

  diskSelect.innerHTML = `<option value="">${t('select_sd')}</option>`;
  selectedDisk = null;

  if (disks.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = t('no_sd');
    opt.disabled = true;
    diskSelect.appendChild(opt);
  } else {
    disks.forEach(disk => {
      const opt = document.createElement('option');
      opt.value = disk.device;
      opt.textContent = disk.name;
      diskSelect.appendChild(opt);
    });
  }

  updateFlashButton();
}

diskSelect.addEventListener('change', () => {
  selectedDisk = diskSelect.value || null;
  updateFlashButton();
});

$('btn-refresh-disks').addEventListener('click', refreshDisks);

// ---------------------------------------------------------------------------
// Flash button state
// ---------------------------------------------------------------------------
function updateFlashButton() {
  btnFlash.disabled = !(imagePath && selectedConsole && selectedPanel && selectedDisk);
}

// ---------------------------------------------------------------------------
// File selection
// ---------------------------------------------------------------------------
$('btn-select-file').addEventListener('click', async () => {
  try {
    const selected = await window.__TAURI__.dialog.open({
      filters: [{
        name: 'Arch R Image',
        extensions: ['img', 'xz']
      }]
    });

    if (selected) {
      imagePath = selected;
      const fileName = selected.split(/[/\\]/).pop();
      imageNameEl.textContent = fileName;
      imageNameEl.removeAttribute('data-i18n');
      imageNameEl.style.color = 'var(--text)';
      updateFlashButton();
    }
  } catch (e) {
    setStatus(t('error_select_file') + e, 'error');
  }
});

// ---------------------------------------------------------------------------
// Download latest
// ---------------------------------------------------------------------------
$('btn-download').addEventListener('click', async () => {
  setStatus(t('checking_version'), '');
  try {
    const release = await window.__TAURI__.core.invoke('check_latest_release');
    imageVersionEl.textContent = release.version;
    setStatus(t('available', { name: release.image_name }), '');
    await window.__TAURI__.shell.open(release.download_url);
  } catch (e) {
    setStatus('Error: ' + e, 'error');
  }
});

// ---------------------------------------------------------------------------
// Flash
// ---------------------------------------------------------------------------
$('btn-flash').addEventListener('click', () => {
  const diskName = diskSelect.options[diskSelect.selectedIndex].textContent;
  confirmText.textContent = t('confirm_text', { disk: diskName });
  confirmDialog.style.display = '';
});

$('btn-cancel').addEventListener('click', () => {
  confirmDialog.style.display = 'none';
});

$('btn-confirm').addEventListener('click', async () => {
  confirmDialog.style.display = 'none';
  await startFlash();
});

async function startFlash() {
  btnFlash.disabled = true;
  progressSection.style.display = '';
  setStatus(t('writing'), '');

  try {
    await window.__TAURI__.core.invoke('flash_image', {
      imagePath: imagePath,
      device: selectedDisk,
      panelDtb: selectedPanel.dtb,
      panelId: selectedPanel.id,
      variant: selectedConsole,
    });

    progressFill.style.width = '100%';
    progressPercent.textContent = '100%';
    setStatus(t('done'), 'success');
  } catch (e) {
    setStatus('Error: ' + e, 'error');
  }

  btnFlash.disabled = false;
}

// ---------------------------------------------------------------------------
// Progress listener
// ---------------------------------------------------------------------------
window.__TAURI__.event.listen('flash-progress', (event) => {
  const { percent, stage } = event.payload;
  progressFill.style.width = percent.toFixed(1) + '%';
  progressPercent.textContent = percent.toFixed(0) + '%';
  progressStage.textContent = t(stage) || stage;
});

// ---------------------------------------------------------------------------
// Status helper
// ---------------------------------------------------------------------------
function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
initI18n();
