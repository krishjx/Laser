// Semiconductor Laser Physics Constants
const I_TH = 25.0; // Threshold Current = 25 mA
const SLOPE_EFF = 0.42; // mW per mA above threshold
const SPONT_EFF = 0.007; // Weak spontaneous efficiency
const PEAK_NM = 650; // Central wavelength (nm)

let current_mA = 0.0;
const recordedCurrents = [0];
const recordedPowers = [0];

let liChart = null;
let specChart = null;

// Optical Power Calculation
function getPower(I) {
  if (I <= 0) return 0;
  if (I <= I_TH) {
    return I * SPONT_EFF;
  } else {
    return (I_TH * SPONT_EFF) + (I - I_TH) * SLOPE_EFF;
  }
}

// Spectrum Calculation
function getSpectrum(I) {
  const lambdas = [];
  const intensities = [];
  const p = getPower(I);

  const fwhm = (I < I_TH) ? (35 - (I / I_TH) * 10) : Math.max(0.6, 25 / Math.pow(I / I_TH, 2.5));

  for (let l = 600; l <= 700; l++) {
    lambdas.push(l);
    if (p <= 0) {
      intensities.push(0);
    } else {
      const g = Math.exp(-Math.pow(l - PEAK_NM, 2) / (2 * Math.pow(fwhm / 2.355, 2)));
      intensities.push(g * p);
    }
  }
  return { lambdas, intensities, fwhm };
}

// Procedural Floor & Breadboard Textures (Gives realistic high-definition lab look)
function generateLabTextures() {
  // 1. Lab Floor Tiles Texture
  const fCanvas = document.getElementById('floorCanvas');
  const fCtx = fCanvas.getContext('2d');
  fCtx.fillStyle = '#1e2638';
  fCtx.fillRect(0, 0, 256, 256);
  fCtx.strokeStyle = '#2b354d';
  fCtx.lineWidth = 4;
  fCtx.strokeRect(2, 2, 252, 252);
  fCtx.strokeStyle = '#151c2a';
  fCtx.lineWidth = 1;
  fCtx.strokeRect(0, 0, 256, 256);

  // 2. Optical Breadboard Grid Texture
  const bCanvas = document.getElementById('breadboardCanvas');
  const bCtx = bCanvas.getContext('2d');
  bCtx.fillStyle = '#121721';
  bCtx.fillRect(0, 0, 256, 256);
  bCtx.fillStyle = '#06080d';
  for (let x = 16; x < 256; x += 32) {
    for (let y = 16; y < 256; y += 32) {
      bCtx.beginPath();
      bCtx.arc(x, y, 4, 0, Math.PI * 2);
      bCtx.fill();
    }
  }
}

// Initialize Dual Virtual Monitors
function setupCharts() {
  const ctxLI = document.getElementById('liChartCanvas').getContext('2d');
  liChart = new Chart(ctxLI, {
    type: 'line',
    data: {
      labels: recordedCurrents,
      datasets: [{
        label: 'Power P (mW)',
        data: recordedPowers,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.25)',
        fill: true,
        pointRadius: 3
      }]
    },
    options: {
      animation: false,
      scales: {
        x: { title: { display: true, text: 'Current I (mA)', color: '#fff' }, ticks: { color: '#94a3b8' } },
        y: { title: { display: true, text: 'Power P (mW)', color: '#fff' }, min: 0, max: 20, ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { labels: { color: '#ffffff' } } }
    }
  });

  const ctxSpec = document.getElementById('specChartCanvas').getContext('2d');
  specChart = new Chart(ctxSpec, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Spectrum Profile',
        data: [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.35)',
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      animation: false,
      scales: {
        x: { title: { display: true, text: 'Wavelength (nm)', color: '#fff' }, ticks: { color: '#94a3b8' } },
        y: { title: { display: true, text: 'Intensity', color: '#fff' }, min: 0, max: 20, ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { labels: { color: '#ffffff' } } }
    }
  });
}

// Refresh VR Screens
function refreshMonitors() {
  const liPlane = document.querySelector('#li-screen');
  const specPlane = document.querySelector('#spec-screen');

  if (liPlane && liPlane.getObject3D('mesh')) {
    const mat = liPlane.getObject3D('mesh').material;
    if (mat.map) mat.map.needsUpdate = true;
  }
  if (specPlane && specPlane.getObject3D('mesh')) {
    const mat = specPlane.getObject3D('mesh').material;
    if (mat.map) mat.map.needsUpdate = true;
  }
}
// Simulation & UI Loop
function updateSimulation() {
  const p = getPower(current_mA);
  const spec = getSpectrum(current_mA);

  // LCD Readout
  const lcd = document.querySelector('#lcd-display');
  if (lcd) lcd.setAttribute('value', I: ${current_mA.toFixed(1)} mA\nP: ${p.toFixed(2)} mW);

  // Laser Beam Intensity & Collimation
  const beam = document.querySelector('#laser-beam');
  if (beam) {
    if (current_mA <= 0) {
      beam.setAttribute('material', 'opacity', 0.0);
    } else if (current_mA < I_TH) {
      beam.setAttribute('radius', 0.007);
      beam.setAttribute('material', 'opacity', 0.16);
      beam.setAttribute('color', '#f87171');
    } else {
      beam.setAttribute('radius', 0.0032);
      const intensity = Math.min(1.0, 0.5 + (current_mA - I_TH) * 0.035);
      beam.setAttribute('material', 'opacity', intensity);
      beam.setAttribute('color', '#ff0000');
    }
  }

  // Live HUD Status (Clear & Non-Overlapping)
  const title = document.querySelector('#live-state-title');
  const desc = document.querySelector('#live-state-desc');

  if (title && desc) {
    if (current_mA <= 0) {
      title.setAttribute('value', 'CURRENT EMISSION: [SYSTEM OFF / IDLE]');
      title.setAttribute('color', '#94a3b8');
      desc.setAttribute('value', 'Injection Current: 0.0 mA | Threshold: 25.0 mA\nClick "+5 mA" or "+1 mA" to start characterization.');
    } else if (current_mA < I_TH) {
      title.setAttribute('value', 'CURRENT EMISSION: SPONTANEOUS (LED MODE)');
      title.setAttribute('color', '#fbbf24');
      desc.setAttribute('value', Current: ${current_mA.toFixed(1)} mA (< Ith 25mA) | Power: ${p.toFixed(3)} mW\nBroadband emission with large linewidth (FWHM: ~${spec.fwhm.toFixed(1)} nm).);
    } else {
      title.setAttribute('value', 'CURRENT EMISSION: STIMULATED (LASING!)');
      title.setAttribute('color', '#22c55e');
      desc.setAttribute('value', Current: ${current_mA.toFixed(1)} mA (>= Ith 25mA) | Power: ${p.toFixed(2)} mW\nPopulation inversion achieved! Sharp coherent peak (FWHM: ${spec.fwhm.toFixed(2)} nm).);
    }
  }

  // Update Data Points
  recordedCurrents.push(parseFloat(current_mA.toFixed(1)));
  recordedPowers.push(parseFloat(p.toFixed(3)));
  liChart.update();

  specChart.data.labels = spec.lambdas;
  specChart.data.datasets[0].data = spec.intensities;
  specChart.update();

  refreshMonitors();
}

// Event Bindings
window.addEventListener('DOMContentLoaded', () => {
  generateLabTextures();
  setupCharts();
  updateSimulation();

  document.querySelector('#btn-increase').addEventListener('click', () => {
    if (current_mA < 60) {
      current_mA += 5;
      updateSimulation();
    }
  });

  document.querySelector('#btn-step-fine').addEventListener('click', () => {
    if (current_mA < 60) {
      current_mA += 1;
      updateSimulation();
    }
  });

  document.querySelector('#btn-decrease').addEventListener('click', () => {
    if (current_mA >= 1) {
      current_mA = Math.max(0, current_mA - (current_mA >= 5 ? 5 : 1));
      updateSimulation();
    }
  });

  document.querySelector('#btn-reset').addEventListener('click', () => {
    current_mA = 0;
    recordedCurrents.length = 1;
    recordedPowers.length = 1;
    recordedCurrents[0] = 0;
    recordedPowers[0] = 0;
    updateSimulation();
  });
});


