// Laser Diode Parameters
const I_TH = 25.0; // Threshold Current = 25 mA
const SLOPE_EFF = 0.42; // mW per mA above threshold
const SPONT_EFF = 0.007; // Weak emission below threshold
const PEAK_NM = 650; // 650 nm Red Diode

let current_mA = 0.0;
const recordedCurrents = [0];
const recordedPowers = [0];

let liChart = null;
let specChart = null;

// 1. Calculate Optical Power (P) from Current (I)
function getPower(I) {
  if (I <= 0) return 0;
  if (I <= I_TH) {
    return I * SPONT_EFF; // Spontaneous emission
  } else {
    return (I_TH * SPONT_EFF) + (I - I_TH) * SLOPE_EFF; // Stimulated emission (Lasing)
  }
}

// 2. Generate Spectrum Data
function getSpectrum(I) {
  const lambdas = [];
  const intensities = [];
  const p = getPower(I);

  // Spectral linewidth collapses when stimulated emission occurs
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

// 3. Set Up Graphs on the Virtual Monitors
function setupCharts() {
  const ctxLI = document.getElementById('liChartCanvas').getContext('2d');
  liChart = new Chart(ctxLI, {
    type: 'line',
    data: {
      labels: recordedCurrents,
      datasets: [{
        label: 'Power (mW)',
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
        x: { title: { display: true, text: 'Current (mA)', color: '#fff' }, ticks: { color: '#ccc' } },
        y: { title: { display: true, text: 'Power (mW)', color: '#fff' }, min: 0, max: 20, ticks: { color: '#ccc' } }
      },
      plugins: { legend: { labels: { color: '#fff' } } }
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
        x: { title: { display: true, text: 'Wavelength (nm)', color: '#fff' }, ticks: { color: '#ccc' } },
        y: { title: { display: true, text: 'Intensity', color: '#fff' }, min: 0, max: 20, ticks: { color: '#ccc' } }
      },
      plugins: { legend: { labels: { color: '#fff' } } }
    }
  });
}

// 4. Redraw 3D Monitors in VR
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

// 5. Update Everything When Current Changes
function updateSimulation() {
  const p = getPower(current_mA);
  const spec = getSpectrum(current_mA);

  // Update Driver LCD
  const lcd = document.querySelector('#lcd-display');
  if (lcd) lcd.setAttribute('value', I: ${current_mA.toFixed(1)} mA\nP: ${p.toFixed(2)} mW);

  // Update Beam Appearance
  const beam = document.querySelector('#laser-beam');
  if (beam) {
    if (current_mA <= 0) {
      beam.setAttribute('material', 'opacity', 0.0);
    } else if (current_mA < I_TH) {
      beam.setAttribute('radius', 0.007);
      beam.setAttribute('material', 'opacity', 0.15); // faint spontaneous light
    } else {
      beam.setAttribute('radius', 0.0035);
      beam.setAttribute('material', 'opacity', Math.min(1.0, 0.5 + (current_mA - I_TH) * 0.03)); // coherent bright beam
    }
  }
  // Update Theory Whiteboard Status
  const status = document.querySelector('#theory-live-status');
  if (status) {
    if (current_mA <= 0) {
      status.setAttribute('value', STATE: [OFF]\n- Current: 0.0 mA\n- Click [+5 mA] to start.);
    } else if (current_mA < I_TH) {
      status.setAttribute('value', STATE: SPONTANEOUS EMISSION\n- Below threshold (I < 25 mA)\n- Wide LED-like band (~${spec.fwhm.toFixed(1)} nm));
    } else {
      status.setAttribute('value', STATE: LASING (STIMULATED EMISSION)\n- Above threshold (I >= 25 mA)\n- Narrow laser linewidth (~${spec.fwhm.toFixed(2)} nm));
    }
  }

  // Record data and update charts
  recordedCurrents.push(parseFloat(current_mA.toFixed(1)));
  recordedPowers.push(parseFloat(p.toFixed(3)));
  liChart.update();

  specChart.data.labels = spec.lambdas;
  specChart.data.datasets[0].data = spec.intensities;
  specChart.update();

  refreshMonitors();
}

// Button Events
window.addEventListener('DOMContentLoaded', () => {
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

