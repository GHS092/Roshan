// app.js - Lógica principal de GHS Finanzas con correcciones aplicadas
// Fecha de actualización: 06 de marzo de 2025

// Verificación inicial de dependencias externas
function checkDependencies() {
  const dependencies = {
    'Chart.js': typeof Chart !== 'undefined',
    'jsPDF': typeof window.jspdf !== 'undefined',
    'uuid': typeof uuid !== 'undefined',
    'moment': typeof moment !== 'undefined'
  };
  for (const [lib, loaded] of Object.entries(dependencies)) {
    if (!loaded) {
      showNotification('Error', `No se pudo cargar ${lib}. Verifica tu conexión.`, 'error');
      return false;
    }
  }
  return true;
}

// Gestión de transacciones en un objeto para evitar variables globales
const state = {
  transactions: [],
  categories: [],
  savingsBalance: 0,
  savingsHistory: []
};

// Función para importar transacciones desde CSV
function importTransactionsCSV() {
  if (!checkDependencies()) return;
  const fileInput = document.getElementById('csvFileInput');
  if (!fileInput) {
    console.warn('Elemento csvFileInput no encontrado');
    return;
  }
  fileInput.onchange = async event => {
    const file = event.target.files[0];
    if (file) {
      try {
        const text = await file.text();
        const importedTransactions = parseCSV(text);
        if (importedTransactions.length === 0) {
          throw new Error('No se encontraron transacciones válidas en el archivo CSV');
        }
        for (const transaction of importedTransactions) {
          state.transactions.push(transaction);
          await addToDb('transactions', transaction);
          updateSavingsFromTransaction(transaction);
        }
        updateDashboard();
        initializeFilters();
        updateHistoryList();
        showNotification('¡Éxito!', `${importedTransactions.length} transacciones importadas correctamente`, 'success');
      } catch (error) {
        showNotification('Error', `No se pudo importar el archivo CSV: ${error.message}`, 'error');
      }
      fileInput.value = '';
    }
  };
}

// Función mejorada para parsear CSV con validación estricta
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(';').map(header => header.trim().replace(/"/g, ''));
  const transactions = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(value => value.trim());
    if (values.length !== headers.length) {
      console.warn(`Skipping line ${i + 1} due to incorrect number of values.`);
      continue;
    }
    const transaction = headers.reduce((obj, header, index) => {
      let value = values[index];
      if (header === 'Monto') {
        value = value.replace(/[^\d,.-]/g, '').replace(/,/g, '.');
        if (!/^-?\d+\.?\d*$/.test(value)) {
          showNotification('Error', `Formato de monto inválido en la línea ${i + 1}`, 'error');
          return null;
        }
        value = parseFloat(value);
        if (isNaN(value)) return null;
        value = parseFloat(value.toFixed(2));
      } else if (header === 'Fecha') {
        value = value.replace(/"/g, '').split('-').map(part => part.padStart(2, '0')).join('-');
      } else if (header === 'Descripción' || header === 'Categoría' || header === 'Tipo de Costo') {
        value = value.replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
      }
      obj[header.toLowerCase()] = value;
      return obj;
    }, {});
    if (transaction && typeof transaction.monto === 'number') {
      transactions.push({
        id: uuid.v4(),
        type: transaction.tipo === 'Ingreso' ? 'entrada' : 'saida',
        costType: transaction['tipo de costo'] || '',
        amount: transaction.monto,
        category: transaction.categoría,
        date: transaction.fecha,
        description: transaction.descripción
      });
    }
  }
  return transactions;
}

// Configuración de IndexedDB
const DB_NAME = 'financeAppDB';
const DB_VERSION = 1;
let db;

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = event => reject(new Error('Database error: ' + event.target.errorCode));
    request.onsuccess = event => {
      db = event.target.result;
      resolve();
    };
    request.onupgradeneeded = event => {
      console.log('Upgrading database...');
      const db = event.target.result;
      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        usersStore.createIndex('username', 'username', { unique: true });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains('savings')) {
        db.createObjectStore('savings', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Funciones de IndexedDB con manejo de errores mejorado
async function getFromDb(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(new Error('Error getting data: ' + event.target.errorCode));
  });
}

async function getAllFromDb(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(new Error('Error getting all data: ' + event.target.errorCode));
  });
}

async function addToDb(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
      reject(new Error('No se encontró el ID de usuario'));
      return;
    }
    if ((storeName === 'transactions' || storeName === 'savings')) {
      data.userId = userId;
    }
    const request = store.add(data);
    request.onsuccess = event => resolve();
    request.onerror = event => reject(new Error('Error adding data: ' + event.target.errorCode));
  });
}

async function putToDb(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = event => resolve();
    request.onerror = event => reject(new Error('Error updating data: ' + event.target.errorCode));
  });
}

async function deleteFromDb(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = event => resolve();
    request.onerror = event => reject(new Error('Error deleting data: ' + event.target.errorCode));
  });
}

// Generación de reportes PDF con paginación mejorada
function downloadCompleteReport() {
  if (!checkDependencies()) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const userId = sessionStorage.getItem('userId');
  if (!userId) {
    showNotification('Error', 'No se encontró el ID de usuario', 'error');
    return;
  }
  const userTransactions = state.transactions.filter(t => t.userId === userId);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text('REPORTE FINANCIERO', 105, 20, { align: "center" });
  doc.line(20, 22, 190, 22);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${new Intl.DateTimeFormat('es-ES').format(new Date())}`, 20, 30);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('Indicadores Clave de Rendimiento (KPIs)', 20, 45);
  doc.line(20, 47, 190, 47);

  const kpis = calculateKPIs();
  let yPos = 55;
  doc.setFillColor(240, 240, 240);
  doc.rect(25, yPos, 160, 10, 'F');
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Indicador", 30, yPos + 7);
  doc.text("Valor Actual", 90, yPos + 7);
  doc.text("Comparativa", 140, yPos + 7);
  doc.setFont("helvetica", "normal");
  yPos += 15;

  const kpiRows = [
    { name: "Margen Bruto", value: kpis.grossMarginText, compare: kpis.prevGrossMargin },
    { name: "Crecimiento de Ingresos", value: kpis.revenueGrowthText, compare: `S/. ${formatNumber(kpis.currentRevenue)} vs S/. ${formatNumber(kpis.prevRevenue)}` },
    { name: "Punto de Equilibrio", value: kpis.breakevenText, compare: "Nivel mínimo de ingresos requerido" }
  ];

  kpiRows.forEach(row => {
    doc.text(row.name, 30, yPos);
    doc.text(row.value, 90, yPos);
    doc.text(row.compare, 140, yPos);
    yPos += 10;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
  });

  // Más secciones del reporte con paginación similar...

  doc.save('reporte_financiero_completo.pdf');
}

// Cálculo centralizado de KPIs
function calculateKPIs() {
  const userId = sessionStorage.getItem('userId');
  if (!userId) return { grossMarginText: 'N/A', revenueGrowthText: 'N/A', breakevenText: 'N/A' };
  const userTransactions = state.transactions.filter(t => t.userId === userId);

  const now = moment();
  const currentPrefix = now.format('YYYY-MM');
  const prevMonth = now.clone().subtract(1, 'month');
  const prevPrefix = prevMonth.format('YYYY-MM');

  const currentRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith(currentPrefix)).reduce((sum, t) => sum + t.amount, 0);
  const currentCosts = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith(currentPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const prevRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith(prevPrefix)).reduce((sum, t) => sum + t.amount, 0);
  const prevCosts = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith(prevPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const currentFixedCosts = userTransactions.filter(t => t.type === 'saida' && t.costType === 'fijo' && t.date.startsWith(currentPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const currentGrossMargin = currentRevenue > 0 ? (currentRevenue - currentCosts) / currentRevenue * 100 : 0;
  const prevGrossMargin = prevRevenue > 0 ? (prevRevenue - prevCosts) / prevRevenue * 100 : 0;
  const grossMarginText = currentRevenue > 0 ? `${currentGrossMargin.toFixed(1)}%` : "N/A";
  const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : "N/A";
  const breakeven = currentGrossMargin > 0 ? (currentFixedCosts / (currentGrossMargin / 100)).toFixed(2) : "N/A";

  return {
    grossMarginText,
    revenueGrowthText: revenueGrowth !== "N/A" ? `${revenueGrowth}%` : "N/A",
    breakevenText: breakeven !== "N/A" ? `S/. ${formatNumber(breakeven)}` : "N/A",
    currentRevenue,
    prevRevenue,
    prevGrossMargin: prevGrossMargin.toFixed(1) + "%"
  };
}

function updateKPIDisplay(elementId, value, trend, comparisonHtml) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Elemento ${elementId} no encontrado`);
    return;
  }
  element.textContent = value;
  element.className = `kpi-value ${trend > 0 ? 'trend-positive' : trend < 0 ? 'trend-negative' : 'trend-neutral'}`;
  const comparisonElement = document.getElementById(`${elementId}Comparison`);
  if (comparisonElement) comparisonElement.innerHTML = comparisonHtml;
}

function updateDashboard() {
  if (!checkDependencies()) return;
  const userId = sessionStorage.getItem('userId');
  if (!userId) {
    showNotification('Error', 'No se encontró el ID de usuario', 'error');
    return;
  }
  const userTransactions = state.transactions.filter(t => t.userId === userId);
  const totalBalance = userTransactions.reduce((sum, t) => sum + t.amount, 0);
  const balanceElement = document.querySelector('#dashboard .card-text.text-primary');
  if (balanceElement) balanceElement.textContent = `S/. ${formatNumber(totalBalance)}`;

  const now = moment();
  const currentPrefix = now.format('YYYY-MM');
  const currentRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith(currentPrefix)).reduce((sum, t) => sum + t.amount, 0);
  const currentExpenses = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith(currentPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  document.querySelector('#ingresosMesActual').textContent = `S/. ${formatNumber(currentRevenue)}`;
  document.querySelector('#gastosMesActual').textContent = `S/. ${formatNumber(currentExpenses)}`;

  const kpis = calculateKPIs();
  updateKPIDisplay('grossMargin', kpis.grossMarginText, kpis.grossMarginText !== "N/A" ? parseFloat(kpis.grossMarginText) - parseFloat(kpis.prevGrossMargin) : 0, 'Comparación del margen bruto');
}

// Función para formatear números con internacionalización
function formatNumber(value) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

// Notificación personalizada
function showNotification(title, message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `custom-notification ${type}`;
  notification.innerHTML = `
    <div class="notification-title">${title}</div>
    <div class="notification-message">${message}</div>
    <div class="notification-progress"></div>
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => notification.remove(), duration);
}

// Función placeholder para otras funciones requeridas por el HTML
function updateSavingsFromTransaction(transaction) {
  console.log('Updating savings from transaction:', transaction);
}

function initializeFilters() {
  console.log('Initializing filters');
}

function updateHistoryList() {
  console.log('Updating history list');
}

// Exportar funciones si es necesario para otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    importTransactionsCSV,
    parseCSV,
    openDatabase,
    getFromDb,
    addToDb,
    downloadCompleteReport,
    calculateKPIs,
    updateKPIDisplay,
    updateDashboard
  };
}
