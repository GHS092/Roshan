function importTransactionsCSV() {
  const fileInput = document.getElementById('csvFileInput');
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
          transactions.push(transaction);
          await addToDb('transactions', transaction);
          updateSavingsFromTransaction(transaction);
        }
        updateDashboard();
        initializeFilters();
        updateHistoryList();
        showNotification('¡Éxito!', `${importedTransactions.length} transacciones importadas correctamente`, 'success');
      } catch (error) {
        console.error('Error al leer o procesar el archivo CSV:', error);
        showNotification('Error', 'No se pudo importar el archivo CSV. Por favor, verifica el formato.', 'error');
      }
    }
    fileInput.value = '';
  };
}
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
        value = value.replace(/[^\d,.,-]/g, '').replace(/,/g, '').replace(/\.(\d{2})$/, ',$1').replace(/\./g, '').replace(/,/g, '.');
        value = parseFloat(value);
        if (isNaN(value)) {
          showNotification('Error', `Error en la linea ${i + 1} del CSV. El valor del monto es inválido.`, 'error');
          return null;
        }
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
const DB_NAME = 'financeAppDB';
const DB_VERSION = 1;
let db;
async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = event => {
      reject('Database error: ' + event.target.errorCode);
    };
    request.onsuccess = event => {
      db = event.target.result;
      resolve();
    };
    request.onupgradeneeded = event => {
      console.log('Upgrading database...');
      const db = event.target.result;
      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', {
          keyPath: 'id'
        });
        usersStore.createIndex('username', 'username', {
          unique: true
        });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', {
          keyPath: 'id'
        });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', {
          keyPath: 'name'
        });
      }
      if (!db.objectStoreNames.contains('savings')) {
        db.createObjectStore('savings', {
          keyPath: 'id',
          autoIncrement: true
        });
      }
    };
  });
}
async function getFromDb(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    request.onerror = event => {
      reject('Error getting data: ' + event.target.errorCode);
    };
  });
}
async function getAllFromDb(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    request.onerror = event => {
      reject('Error getting all data: ' + event.target.errorCode);
    };
  });
}
async function addToDb(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    if ((storeName === 'transactions' || storeName === 'savings') && sessionStorage.getItem('userId')) {
      data.userId = sessionStorage.getItem('userId');
    }
    const request = store.add(data);
    request.onsuccess = event => resolve();
    request.onerror = event => reject('Error adding data: ' + event.target.errorCode);
  });
}
async function putToDb(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = event => {
      resolve();
    };
    request.onerror = event => {
      reject('Error updating data: ' + event.target.errorCode);
    };
  });
}
async function deleteFromDb(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = event => {
      resolve();
    };
    request.onerror = event => {
      reject('Error deleting data: ' + event.target.errorCode);
    };
  });
}
async function clearObjectStore(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = event => {
      resolve();
    };
    request.onerror = event => {
      reject('Error clearing object store: ' + event.target.errorCode);
    };
  });
}
let transactions = [];
let categories = [];
let savingsBalance = 0;
let savingsHistory = [];
function downloadCompleteReport() {
  const {
    jsPDF
  } = window.jspdf;
  const doc = new jsPDF();
  const userId = sessionStorage.getItem('userId');
  const userTransactions = transactions.filter(t => t.userId === userId);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text('REPORTE FINANCIERO', 105, 20, {
    align: "center"
  });
  doc.line(20, 22, 190, 22);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('Indicadores Clave de Rendimiento (KPIs)', 20, 45);
  doc.setLineWidth(0.5);
  doc.line(20, 47, 190, 47);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const currentMonthRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith(`${currentYear}`)).reduce((sum, t) => sum + t.amount, 0);
  const currentMonthExpenses = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith(`${currentYear}`)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const prevMonthRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith('2024-12')).reduce((sum, t) => sum + t.amount, 0);
  const prevMonthCosts = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith('2024-12')).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const currentMonthFixedCosts = userTransactions.filter(t => t.type === 'saida' && t.costType === 'fijo' && t.date.startsWith('2025-01')).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  function getMonthYear(dateString) {
    const [year, month] = dateString.split('-');
    return {
      year: parseInt(year),
      month: parseInt(month)
    };
  }
  const dates = userTransactions.map(t => t.date).sort((a, b) => b.localeCompare(a));
  const currentDateKPI = dates.length > 0 ? getMonthYear(dates[0]) : {
    year: 2025,
    month: 1
  };
  let prevYear = currentDateKPI.year;
  let prevMonth = currentDateKPI.month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }
  const currentPrefix = `${currentDateKPI.year}-${String(currentDateKPI.month).padStart(2, '0')}`;
  const prevPrefix = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const dynamicCurrentMonthRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith(currentPrefix)).reduce((sum, t) => sum + t.amount, 0);
  const dynamicCurrentMonthCosts = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith(currentPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const dynamicPrevMonthRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith(prevPrefix)).reduce((sum, t) => sum + t.amount, 0);
  const dynamicPrevMonthCosts = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith(prevPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const currentGrossMargin = dynamicCurrentMonthRevenue > 0 ? (dynamicCurrentMonthRevenue - dynamicCurrentMonthCosts) / dynamicCurrentMonthRevenue * 100 : 0;
  const prevGrossMargin = dynamicPrevMonthRevenue > 0 ? (dynamicPrevMonthRevenue - dynamicPrevMonthCosts) / dynamicPrevMonthRevenue * 100 : 0;
  const grossMargin = dynamicCurrentMonthRevenue > 0 ? ((dynamicCurrentMonthRevenue - dynamicCurrentMonthCosts) / dynamicCurrentMonthRevenue * 100).toFixed(1) : "N/A";
  const revenueGrowth = dynamicPrevMonthRevenue > 0 ? ((dynamicCurrentMonthRevenue - dynamicPrevMonthRevenue) / dynamicPrevMonthRevenue * 100).toFixed(1) : "N/A";
  const breakeven = currentGrossMargin > 0 ? (currentMonthFixedCosts / (currentGrossMargin / 100)).toFixed(2) : "N/A";
  let yPos = 55;
  doc.setFillColor(240, 240, 240);
  doc.rect(25, yPos, 160, 10, 'F');
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Indicador", 30, yPos + 7);
  doc.text("Valor Actual", 90, yPos + 7);
  doc.text("Comparativa", 140, yPos + 7);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  yPos += 15;
  doc.text("Margen Bruto", 30, yPos);
  if (grossMargin !== "N/A") {
    if (parseFloat(grossMargin) > 0) {
      doc.setTextColor(40, 167, 69);
    } else if (parseFloat(grossMargin) < 0) {
      doc.setTextColor(220, 53, 69);
    } else {
      doc.setTextColor(0, 0, 255);
    }
  }
  doc.text(`${grossMargin}%`, 90, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(`vs ${prevGrossMargin > 0 ? prevGrossMargin.toFixed(1) + "%" : "N/A"}`, 140, yPos);
  yPos += 10;
  doc.text("Crecimiento de Ingresos", 30, yPos);
  if (revenueGrowth !== "N/A") {
    if (parseFloat(revenueGrowth) > 0) {
      doc.setTextColor(40, 167, 69);
    } else if (parseFloat(revenueGrowth) < 0) {
      doc.setTextColor(220, 53, 69);
    } else {
      doc.setTextColor(0, 0, 255);
    }
  }
  doc.text(`${revenueGrowth}%`, 90, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(`S/. ${formatNumber(dynamicCurrentMonthRevenue)} vs S/. ${formatNumber(dynamicPrevMonthRevenue)}`, 140, yPos);
  yPos += 10;
  doc.text("Punto de Equilibrio", 30, yPos);
  doc.text(`S/. ${breakeven}`, 90, yPos);
  doc.text("Nivel mínimo de ingresos requerido", 140, yPos);
  yPos += 20;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('Balance General', 20, yPos);
  doc.line(20, yPos + 2, 190, yPos + 2);
  const balanceText = generateBalancoPatrimonial().replace(/<[^>]*>/g, '').split('\n').filter(line => line.trim());
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  yPos += 10;
  balanceText.forEach(line => {
    doc.text(line.trim(), 25, yPos);
    yPos += 8;
  });
  yPos += 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('Estado de Resultados', 20, yPos);
  doc.line(20, yPos + 2, 190, yPos + 2);
  const dreText = generateDRE().replace(/<[^>]*>/g, '').split('\n').filter(line => line.trim());
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  yPos += 10;
  dreText.forEach(line => {
    doc.text(line.trim(), 25, yPos);
    yPos += 8;
  });
  doc.addPage();
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('Flujo de Caja', 20, 20);
  doc.line(20, 22, 190, 22);
  yPos = 30;
  doc.setFillColor(240, 240, 240);
  doc.rect(25, yPos, 160, 10, 'F');
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Periodo", 30, yPos + 7);
  doc.text("Ingresos", 65, yPos + 7);
  doc.text("Gastos", 100, yPos + 7);
  doc.text("Flujo Neto", 135, yPos + 7);
  doc.text("Acumulado", 170, yPos + 7);
  const monthlyFlow = userTransactions.reduce((acc, t) => {
    const month = t.date.substring(0, 7);
    if (!acc[month]) {
      acc[month] = {
        ingresos: 0,
        gastos: 0,
        flujoNeto: 0
      };
    }
    if (t.type === 'entrada') {
      acc[month].ingresos += t.amount;
    } else {
      acc[month].gastos += Math.abs(t.amount);
    }
    acc[month].flujoNeto = acc[month].ingresos - acc[month].gastos;
    return acc;
  }, {});
  const sortedMonths = Object.entries(monthlyFlow).sort(([monthA], [monthB]) => monthB.localeCompare(monthA));
  doc.setFont("helvetica", "normal");
  yPos += 15;
  let acumulado = 0;
  sortedMonths.forEach(([month, data], index) => {
    acumulado += data.flujoNeto;
    const [year, monthNum] = month.split('-');
    const monthName = new Date(year, monthNum - 1).toLocaleString('es-ES', {
      month: 'long'
    });
    doc.text(monthName + ' ' + year, 30, yPos);
    doc.text(`S/. ${formatNumber(data.ingresos)}`, 65, yPos);
    doc.text(`S/. ${formatNumber(data.gastos)}`, 100, yPos);
    if (data.flujoNeto >= 0) {
      doc.setTextColor(40, 167, 69);
    } else {
      doc.setTextColor(220, 53, 69);
    }
    doc.text(`S/. ${formatNumber(data.flujoNeto)}`, 135, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(`S/. ${formatNumber(acumulado)}`, 170, yPos);
    yPos += 10;
    if (yPos > 270) {
      doc.addPage();
      yPos = 30;
    }
  });
  doc.addPage();
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('Transacciones Recientes', 105, 20, {
    align: "center"
  });
  doc.line(20, 22, 190, 22);
  yPos = 30;
  doc.setFillColor(240, 240, 240);
  doc.rect(25, yPos, 160, 10, 'F');
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Fecha", 30, yPos + 7);
  doc.text("Categoría", 70, yPos + 7);
  doc.text("Descripción", 110, yPos + 7);
  doc.text("Monto", 160, yPos + 7);
  doc.setFont("helvetica", "normal");
  yPos += 15;
  const recentExpenses = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith('2025')).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  recentExpenses.forEach(expense => {
    doc.text(expense.date, 30, yPos);
    doc.text(expense.category, 70, yPos);
    doc.text(expense.description.substring(0, 20), 110, yPos);
    doc.text(`S/. ${formatNumber(Math.abs(expense.amount))}`, 160, yPos);
    yPos += 8;
  });
  yPos += 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text('Ingresos Recientes', 20, yPos);
  const recentIncome = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith('2025')).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  yPos += 10;
  doc.setFillColor(240, 240, 240);
  doc.rect(25, yPos, 160, 10, 'F');
  doc.text("Fecha", 30, yPos + 7);
  doc.text("Categoría", 70, yPos + 7);
  doc.text("Descripción", 110, yPos + 7);
  doc.text("Monto", 160, yPos + 7);
  doc.setFont("helvetica", "normal");
  yPos += 15;
  recentIncome.forEach(income => {
    doc.text(income.date, 30, yPos);
    doc.text(income.category, 70, yPos);
    doc.text(income.description.substring(0, 20), 110, yPos);
    doc.text(`S/. ${formatNumber(income.amount)}`, 160, yPos);
    yPos += 8;
  });
  doc.save('reporte_financiero_completo.pdf');
}
function calculateKPIs() {
  const userId = sessionStorage.getItem('userId');
  const userTransactions = transactions.filter(t => t.userId === userId);
  const currentMonthRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith('2025-01')).reduce((sum, t) => sum + t.amount, 0);
  const currentMonthCosts = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith('2025-01')).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const prevMonthRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith('2024-12')).reduce((sum, t) => sum + t.amount, 0);
  const prevMonthCosts = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith('2024-12')).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const currentMonthFixedCosts = userTransactions.filter(t => t.type === 'saida' && t.costType === 'fijo' && t.date.startsWith('2025-01')).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  function getMonthYear(dateString) {
    const [year, month] = dateString.split('-');
    return {
      year: parseInt(year),
      month: parseInt(month)
    };
  }
  const dates = userTransactions.map(t => t.date).sort((a, b) => b.localeCompare(a));
  const currentDate = dates.length > 0 ? getMonthYear(dates[0]) : {
    year: 2025,
    month: 1
  };
  let prevYear = currentDate.year;
  let prevMonth = currentDate.month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }
  const currentPrefix = `${currentDate.year}-${String(currentDate.month).padStart(2, '0')}`;
  const prevPrefix = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const dynamicCurrentMonthRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith(currentPrefix)).reduce((sum, t) => sum + t.amount, 0);
  const dynamicCurrentMonthCosts = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith(currentPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const dynamicPrevMonthRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith(prevPrefix)).reduce((sum, t) => sum + t.amount, 0);
  const dynamicPrevMonthCosts = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith(prevPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const currentGrossMargin = dynamicCurrentMonthRevenue > 0 ? (dynamicCurrentMonthRevenue - dynamicCurrentMonthCosts) / dynamicCurrentMonthRevenue * 100 : 0;
  const prevGrossMargin = dynamicPrevMonthRevenue > 0 ? (dynamicPrevMonthRevenue - dynamicPrevMonthCosts) / dynamicPrevMonthRevenue * 100 : 0;
  const grossMarginText = dynamicCurrentMonthRevenue > 0 ? `${currentGrossMargin.toFixed(1)}%` : "No hay ingresos registrados";
  const revenueGrowth = dynamicPrevMonthRevenue > 0 ? (dynamicCurrentMonthRevenue - dynamicPrevMonthRevenue) / dynamicPrevMonthRevenue * 100 : 0;
  const revenueGrowthText = dynamicPrevMonthRevenue > 0 ? `${revenueGrowth.toFixed(1)}%` : "Sin datos previos";
  const breakeven = currentGrossMargin > 0 ? currentMonthFixedCosts / (currentGrossMargin / 100) : 0;
  const breakevenText = currentGrossMargin > 0 ? `S/. ${formatNumber(breakeven)}` : "No calculable";
  const monthNames = ['Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  updateKPIDisplay('grossMargin', grossMarginText, currentGrossMargin - prevGrossMargin, `<div>Margen bruto: Ingresos menos costos como porcentaje de ingresos</div>
                             <div>${monthNames[currentDate.month]} ${currentDate.year}: ${currentGrossMargin.toFixed(1)}%</div>
                             <div>${monthNames[prevMonth]} ${prevYear}: ${prevGrossMargin.toFixed(1)}%</div>`);
  updateKPIDisplay('revenueGrowth', revenueGrowthText, revenueGrowth, `<div>Variación de ingresos entre períodos</div>
                             <div>${monthNames[currentDate.month]} ${currentDate.year}: S/. ${formatNumber(dynamicCurrentMonthRevenue)}</div>
                             <div>${monthNames[prevMonth]} ${prevYear}: S/. ${formatNumber(dynamicPrevMonthRevenue)}</div>`);
  updateKPIDisplay('breakeven', breakevenText, null, `<div>Nivel de ingresos necesario para cubrir costos fijos</div>
                             <div>Costos fijos: S/. ${formatNumber(currentMonthFixedCosts)}</div>
                             <div>Margen bruto: ${grossMarginText}</div>`);
  updateKPIDisplay('dashboardGrossMargin', grossMarginText, currentGrossMargin - prevGrossMargin, `<div>Margen bruto: Ingresos menos costos como porcentaje de ingresos</div>
                             <div>${monthNames[currentDate.month]} ${currentDate.year}: ${currentGrossMargin.toFixed(1)}%</div>
                             <div>${monthNames[prevMonth]} ${prevYear}: ${prevGrossMargin.toFixed(1)}%</div>`);
  updateKPIDisplay('dashboardRevenueGrowth', revenueGrowthText, revenueGrowth, `<div>Variación de ingresos entre períodos</div>
                             <div>${monthNames[currentDate.month]} ${currentDate.year}: S/. ${formatNumber(dynamicCurrentMonthRevenue)}</div>
                             <div>${monthNames[prevMonth]} ${prevYear}: S/. ${formatNumber(dynamicPrevMonthRevenue)}</div>`);
  updateKPIDisplay('dashboardBreakeven', breakevenText, null, `<div>Nivel de ingresos necesario para cubrir costos fijos</div>
                             <div>Costos fijos: S/. ${formatNumber(currentMonthFixedCosts)}</div>
                             <div>Margen bruto: ${grossMarginText}</div>`);
}
function updateKPIDisplay(elementId, value, trend, comparisonHtml) {
  const element = document.getElementById(elementId);
  element.textContent = value;
  if (trend !== null) {
    element.className = `kpi-value ${trend > 0 ? 'trend-positive' : trend < 0 ? 'trend-negative' : 'trend-neutral'}`;
  } else {
    element.className = 'kpi-value trend-neutral';
  }
  const comparisonElement = document.getElementById(`${elementId}Comparison`);
  if (comparisonElement) {
    comparisonElement.innerHTML = comparisonHtml;
    if (trend !== null) {
      comparisonElement.innerHTML += `<div>${getComparisonArrow(trend)}</div>`;
    }
  }
}
function getComparisonArrow(value) {
  if (value > 0) {
    return `<div class="trend-arrow up">
                                            <svg viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M7 14l5-5 5 5z"/>
                                            </svg>
                                        </div> <span class="trend-positive">+${Math.abs(value).toFixed(1)}% respecto al mes anterior</span>`;
  } else if (value < 0) {
    return `<div class="trend-arrow down">
                                            <svg viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M7 10l5 5 5-5z"/>
                                            </svg>
                                        </div> <span class="trend-negative">-${Math.abs(value).toFixed(1)}% respecto al mes anterior</span>`;
  }
  return '<span class="trend-neutral">↔ 0% respecto al mes anterior</span>';
}
function updateDashboard() {
  const userId = sessionStorage.getItem('userId');
  const userTransactions = transactions.filter(t => t.userId === userId);
  const totalBalance = userTransactions.reduce((sum, t) => sum + t.amount, 0);
  document.querySelector('#dashboard .card-text.text-primary').textContent = `S/. ${formatNumber(totalBalance)}`;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonthPrefix = `${currentYear}-${currentMonth}`;
  const currentMonthRevenue = userTransactions.filter(t => t.type === 'entrada' && t.date.startsWith(currentMonthPrefix)).reduce((sum, t) => sum + t.amount, 0);
  const currentMonthExpenses = userTransactions.filter(t => t.type === 'saida' && t.date.startsWith(currentMonthPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const currentMonthFixedCosts = userTransactions.filter(t => t.type === 'saida' && t.costType === 'fijo' && t.date.startsWith(currentMonthPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const currentMonthVariableCosts = userTransactions.filter(t => t.type === 'saida' && t.costType === 'variable' && t.date.startsWith(currentMonthPrefix)).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  document.querySelector('#ingresosMesActual').textContent = `S/. ${formatNumber(currentMonthRevenue)}`;
  document.querySelector('#gastosMesActual').textContent = `S/. ${formatNumber(currentMonthExpenses)}`;
  document.querySelector('#costosFijosMesActual').textContent = `S/. ${formatNumber(currentMonthFixedCosts)}`;
  document.querySelector('#costosVariablesMesActual').textContent = `S/. ${formatNumber(currentMonthVariableCosts)}`;

  updateSavingsDisplay();
  calculateKPIs();
  updateChart(userTransactions);
}
