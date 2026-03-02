const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { open } = window.__TAURI__.dialog;

// State
let selectedConsole = null;
let selectedPanel = null;
let selectedDisk = null;
let imagePath = null;

// DOM elements
const btnOriginal = document.getElementById('btn-original');
const btnClone = document.getElementById('btn-clone');
const panelSection = document.getElementById('panel-section');
const panelSelect = document.getElementById('panel-select');
const diskSection = document.getElementById('disk-section');
const diskSelect = document.getElementById('disk-select');
const flashSection = document.getElementById('flash-section');
const btnFlash = document.getElementById('btn-flash');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const progressStage = document.getElementById('progress-stage');
const statusEl = document.getElementById('status');
const imageNameEl = document.getElementById('image-name');
const imageVersionEl = document.getElementById('image-version');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmText = document.getElementById('confirm-text');
const btnConfirm = document.getElementById('btn-confirm');
const btnCancel = document.getElementById('btn-cancel');
const btnSelectFile = document.getElementById('btn-select-file');
const btnDownload = document.getElementById('btn-download');
const btnRefreshDisks = document.getElementById('btn-refresh-disks');

// Console selection
function selectConsole(console) {
  selectedConsole = console;
  selectedPanel = null;

  // Update UI
  btnOriginal.classList.toggle('active', console === 'original');
  btnClone.classList.toggle('active', console === 'clone');

  // Load panels
  loadPanels(console);

  // Show panel section
  panelSection.style.display = '';
  diskSection.style.display = 'none';
  flashSection.style.display = 'none';
  updateFlashButton();
}

btnOriginal.addEventListener('click', () => selectConsole('original'));
btnClone.addEventListener('click', () => selectConsole('clone'));

// Panel loading
async function loadPanels(console) {
  const panels = await invoke('get_panels', { console });

  panelSelect.innerHTML = '<option value="">Selecione o painel</option>';

  panels.forEach(panel => {
    const opt = document.createElement('option');
    opt.value = JSON.stringify({ id: panel.id, dtb: panel.dtb });
    opt.textContent = panel.name + (panel.is_default ? ' (recomendado)' : '');
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

// Disk listing
async function refreshDisks() {
  const disks = await invoke('list_disks');

  diskSelect.innerHTML = '<option value="">Selecione o SD card</option>';
  selectedDisk = null;

  if (disks.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Nenhum SD card encontrado';
    opt.disabled = true;
    diskSelect.appendChild(opt);
  } else {
    disks.forEach(disk => {
      const opt = document.createElement('option');
      opt.value = disk.device;
      opt.textContent = `${disk.name}`;
      diskSelect.appendChild(opt);
    });
  }

  updateFlashButton();
}

diskSelect.addEventListener('change', () => {
  selectedDisk = diskSelect.value || null;
  updateFlashButton();
});

btnRefreshDisks.addEventListener('click', refreshDisks);

// Flash button state
function updateFlashButton() {
  const ready = imagePath && selectedConsole && selectedPanel && selectedDisk;
  btnFlash.disabled = !ready;
}

// File selection
btnSelectFile.addEventListener('click', async () => {
  try {
    const selected = await open({
      filters: [{
        name: 'Arch R Image',
        extensions: ['img', 'img.xz', 'xz']
      }]
    });

    if (selected) {
      imagePath = selected;
      const fileName = selected.split(/[/\\]/).pop();
      imageNameEl.textContent = fileName;
      imageNameEl.style.color = 'var(--text)';
      updateFlashButton();
    }
  } catch (e) {
    setStatus('Erro ao selecionar arquivo: ' + e, 'error');
  }
});

// Download latest
btnDownload.addEventListener('click', async () => {
  setStatus('Verificando ultima versao...', '');
  try {
    const release = await invoke('check_latest_release');
    imageVersionEl.textContent = release.version;
    setStatus(`Disponivel: ${release.image_name}. Use o navegador para baixar.`, '');
    // Open download URL in browser
    window.__TAURI__.shell.open(release.download_url);
  } catch (e) {
    setStatus('Erro: ' + e, 'error');
  }
});

// Flash
btnFlash.addEventListener('click', () => {
  // Show confirmation dialog
  const diskName = diskSelect.options[diskSelect.selectedIndex].textContent;
  confirmText.textContent = `Gravar Arch R em ${diskName}?`;
  confirmDialog.style.display = '';
});

btnCancel.addEventListener('click', () => {
  confirmDialog.style.display = 'none';
});

btnConfirm.addEventListener('click', async () => {
  confirmDialog.style.display = 'none';
  await startFlash();
});

async function startFlash() {
  // Disable controls
  btnFlash.disabled = true;
  progressSection.style.display = '';
  setStatus('Gravando imagem...', '');

  try {
    const result = await invoke('flash_image', {
      imagePath: imagePath,
      device: selectedDisk,
      panelDtb: selectedPanel.dtb,
      panelId: selectedPanel.id,
      variant: selectedConsole,
    });

    progressFill.style.width = '100%';
    progressPercent.textContent = '100%';
    setStatus('SD card pronto! Insira no R36S e ligue.', 'success');
  } catch (e) {
    setStatus('Erro: ' + e, 'error');
  }

  btnFlash.disabled = false;
}

// Progress listener
listen('flash-progress', (event) => {
  const { percent, stage } = event.payload;
  progressFill.style.width = percent.toFixed(1) + '%';
  progressPercent.textContent = percent.toFixed(0) + '%';

  const stages = {
    'writing': 'Gravando imagem...',
    'syncing': 'Sincronizando...',
    'configuring': 'Configurando painel...',
  };
  progressStage.textContent = stages[stage] || stage;
});

// Status helper
function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}
