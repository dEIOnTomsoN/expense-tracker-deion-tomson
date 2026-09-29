// app.js - Main application logic for the Expense Tracker web app.

(function () {
  'use strict';

  // Reject stale or incomplete sessions before loading any account data.
  let currentSession = null;
  try {
    currentSession = JSON.parse(window.localStorage.getItem('currentUser') || 'null');
  } catch (error) {
    window.localStorage.removeItem('currentUser');
  }
  let accountExists = false;
  try {
    const users = JSON.parse(window.localStorage.getItem('app_users') || '[]');
    accountExists = Array.isArray(users) && users.some((user) => user
      && user.id === currentSession?.id
      && user.username === currentSession?.username);
  } catch (error) {
    accountExists = false;
  }
  if (!accountExists || !currentSession || typeof currentSession.id !== 'string' || typeof currentSession.username !== 'string' || !currentSession.username.trim()) {
    window.localStorage.removeItem('currentUser');
    window.location.replace('./login_signup.html');
    return;
  }

  const store = window.ExIState;
  const transactionView = window.ExITransactions;
  const monthInput = document.querySelector('#period-month');
  const yearInput = document.querySelector('#period-year');
  const themeToggle = document.querySelector('#theme-toggle');
  const periodModeInput = document.querySelector('#period-mode');
  const periodAnchorInput = document.querySelector('#period-anchor');
  const periodStartInput = document.querySelector('#period-start');
  const periodEndInput = document.querySelector('#period-end');
  const form = document.querySelector('#transaction-form');
  const rows = document.querySelector('#transaction-rows');
  const message = document.querySelector('#form-message');
  const incomeSummaryCard = document.querySelector('#summary-income-card');
  const expenseSummaryCard = document.querySelector('#summary-expense-card');
  const detailsDialog = document.querySelector('#transaction-details-dialog');
  const detailsTitle = document.querySelector('#details-dialog-title');
  const detailsDescription = document.querySelector('#details-description');
  const detailsCategoryFilter = document.querySelector('#details-category-filter');
  const detailsStartFilter = document.querySelector('#details-start-filter');
  const detailsEndFilter = document.querySelector('#details-end-filter');
  const detailsRows = document.querySelector('#details-transaction-rows');
  const detailsCount = document.querySelector('#details-result-count');
  const detailsTotal = document.querySelector('#details-total');
  const detailsBreakdown = document.querySelector('#details-category-breakdown');
  const detailsChartCanvas = document.querySelector('#details-category-chart');
  const detailsChartFallback = document.querySelector('#details-chart-fallback');
  const transactionType = document.querySelector('#transaction-type');
  const transactionCategory = document.querySelector('#transaction-category');
  const editType = document.querySelector('#edit-type');
  const editCategory = document.querySelector('#edit-category');
  const historyType = document.querySelector('#history-type');
  const historyCategory = document.querySelector('#history-category');
  const historyPeriod = document.querySelector('#history-period');
  const historyMonthInput = document.querySelector('#history-month');
  const historyYearInput = document.querySelector('#history-year');
  const historyAnchorInput = document.querySelector('#history-anchor');
  const historyStartInput = document.querySelector('#history-start');
  const historyEndInput = document.querySelector('#history-end');
  const editDialog = document.querySelector('#edit-transaction-dialog');
  const editForm = document.querySelector('#edit-transaction-form');
  const now = new Date();
  // Apply the theme before the first render and optionally save a user choice.
  function setTheme(theme, persist) {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    themeToggle.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
    themeToggle.querySelector('.theme-toggle-icon').textContent = isDark ? '☀' : '☾';
    if (persist) {
      try {
        window.localStorage.setItem('exi.theme', isDark ? 'dark' : 'light');
      } catch (error) {
        // Keep the selected theme for this page even if storage is unavailable.
      }
    }
  }

  let savedTheme = null;
  try {
    savedTheme = window.localStorage.getItem('exi.theme');
  } catch (error) {
    savedTheme = null;
  }
  setTheme(savedTheme === 'dark' || savedTheme === 'light'
    ? savedTheme
    : 'light', false);

  const palette = ['#6558e8', '#20a778', '#ed9b54', '#4f7be8', '#d16ba5', '#40a6ad', '#e36b69', '#9a83d7'];
  const categoriesByType = {
    income: ['Salary', 'Freelance', 'Business', 'Investments', 'Rental', 'Gifts', 'Other'],
    expense: ['Food', 'Housing', 'Transportation', 'Utilities', 'Shopping', 'Healthcare', 'Education', 'Entertainment', 'Travel', 'Other']
  };
  let categoryChart = null;
  let detailsChart = null;
  let detailsType = 'income';
  let detailsTrigger = null;
  let activityChartSelection = null;
  let activityHoveredIndex = -1;
  let activityActiveType = 'income';

  function updateCategoryOptions(select, type, selectedCategory, preserveUnknown) {
    const categories = categoriesByType[type] || categoriesByType.expense;
    select.replaceChildren();
    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.append(option);
    });
    if (preserveUnknown && selectedCategory && !categories.includes(selectedCategory)) {
      const option = document.createElement('option');
      option.value = selectedCategory;
      option.textContent = selectedCategory;
      select.append(option);
    }
    select.value = categories.includes(selectedCategory) || preserveUnknown
      ? selectedCategory : categories[0];
  }

  function localDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // Populate date controls from saved transaction years and today's date.
  function setupPeriodControls() {
    const currentYear = now.getFullYear();
    const storedYears = store.getTransactions().map((transaction) => Number(transaction.date.slice(0, 4)));
    const years = new Set(storedYears);
    for (let year = currentYear - 5; year <= currentYear + 1; year += 1) years.add(year);
    Array.from(years).sort((a, b) => a - b).forEach((year) => {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      yearInput.append(option);
      historyYearInput.append(option.cloneNode(true));
    });
    monthInput.value = String(now.getMonth() + 1);
    yearInput.value = String(currentYear);
    periodAnchorInput.value = localDateValue(now);
    periodStartInput.value = localDateValue(new Date(currentYear, now.getMonth(), 1));
    periodEndInput.value = localDateValue(now);
    historyMonthInput.value = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    historyYearInput.value = String(currentYear);
    historyAnchorInput.value = localDateValue(now);
    historyStartInput.value = localDateValue(new Date(currentYear, now.getMonth(), 1));
    historyEndInput.value = localDateValue(now);
    document.querySelector('#transaction-date').value = localDateValue(now);
  }

  function selectPeriod(year, month) {
    const hasYear = Array.from(yearInput.options).some((option) => option.value === String(year));
    if (!hasYear) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      yearInput.append(option);
    }
    yearInput.value = String(year);
    monthInput.value = String(month);
    periodModeInput.value = 'monthly';
  }

  function formatDateLabel(year, month) {
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
      .format(new Date(year, month - 1, 1));
  }

  function dateParts(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Keep week boundaries consistent across dashboard and history filters.
  function getWeekRange(dateValue) {
    const startDate = dateParts(dateValue);
    startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return { start: localDateValue(startDate), end: localDateValue(endDate) };
  }

  function formatShortDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(dateParts(value));
  }

  // Convert the selected dashboard mode into date bounds and matching transactions.
  function getDashboardSelection() {
    const mode = periodModeInput.value;
    let start = '';
    let end = '';
    let label = 'Overall';

    if (mode === 'monthly') {
      const year = Number(yearInput.value);
      const month = Number(monthInput.value);
      start = `${year}-${String(month).padStart(2, '0')}-01`;
      end = localDateValue(new Date(year, month, 0));
      label = formatDateLabel(year, month);
    } else if (mode === 'yearly') {
      const year = Number(yearInput.value);
      start = `${year}-01-01`;
      end = `${year}-12-31`;
      label = String(year);
    } else if (mode === 'weekly' || mode === 'today') {
      const anchor = periodAnchorInput.value || localDateValue(now);
      const date = dateParts(anchor);
      if (mode === 'today') {
        start = anchor;
        end = anchor;
        label = `Today · ${formatShortDate(anchor)}`;
      } else {
        const week = getWeekRange(anchor);
        start = week.start;
        end = week.end;
        label = `Week · ${formatShortDate(start)} – ${formatShortDate(end)}`;
      }
    } else if (mode === 'custom') {
      start = periodStartInput.value;
      end = periodEndInput.value;
      if (start && end && start > end) [start, end] = [end, start];
      label = start || end
        ? `${start ? formatShortDate(start) : 'Any date'} – ${end ? formatShortDate(end) : 'Any date'}`
        : 'Overall';
    }

    const transactions = store.getTransactions().filter((transaction) =>
      (!start || transaction.date >= start) && (!end || transaction.date <= end)
    );
    return { mode, start, end, label, transactions };
  }

  function updatePeriodControls() {
    const mode = periodModeInput.value;
    document.querySelector('#period-calendar-controls').hidden = mode !== 'monthly' && mode !== 'yearly';
    monthInput.hidden = mode !== 'monthly';
    yearInput.hidden = mode !== 'monthly' && mode !== 'yearly';
    document.querySelector('#period-anchor-control').hidden = mode !== 'weekly' && mode !== 'today';
    document.querySelector('#period-range-controls').hidden = mode !== 'custom';
  }

  function setFieldError(id, text) {
    const input = document.getElementById(id);
    const error = document.querySelector(`[data-error-for="${id}"]`);
    if (!input || !error) return;
    input.setAttribute('aria-invalid', text ? 'true' : 'false');
    error.textContent = text || '';
  }

  function clearErrors(targetForm) {
    targetForm.querySelectorAll('[data-error-for]').forEach((error) => {
      const input = document.getElementById(error.dataset.errorFor);
      if (input) input.removeAttribute('aria-invalid');
      error.textContent = '';
    });
  }

  function readAndValidate(formElement, prefix) {
    const formData = new FormData(formElement);
    const ids = {
      amount: `${prefix ? 'edit-' : 'transaction-'}amount`,
      date: `${prefix ? 'edit-' : 'transaction-'}date`,
      category: `${prefix ? 'edit-' : 'transaction-'}category`,
      description: `${prefix ? 'edit-' : 'transaction-'}description`
    };
    const data = {
      type: String(formData.get('type') || ''),
      amount: String(formData.get('amount') || '').trim(),
      date: String(formData.get('date') || ''),
      category: String(formData.get('category') || '').trim(),
      description: String(formData.get('description') || '').trim()
    };
    const errors = {
      amount: !data.amount || !Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0
        ? 'Enter an amount greater than zero.' : '',
      date: !store.isValidDate(data.date) ? 'Choose a valid date.' : '',
      category: !data.category ? 'Choose a category.' : '',
      description: !data.description ? 'Enter a description.' : ''
    };
    Object.entries(errors).forEach(([field, error]) => setFieldError(ids[field], error));
    const firstInvalid = Object.keys(errors).find((field) => errors[field]);
    if (firstInvalid) {
      document.getElementById(ids[firstInvalid])?.focus();
      return null;
    }
    data.amount = Number(data.amount);
    return data;
  }

  function setMessage(text, isSuccess) {
    message.textContent = text;
    message.classList.toggle('is-success', Boolean(isSuccess));
  }

  function renderSummary(transactions, label) {
    const totals = transactions.reduce((summary, transaction) => {
      summary[transaction.type] += transaction.amount;
      return summary;
    }, { income: 0, expense: 0 });
    const balance = totals.income - totals.expense;
    document.querySelector('#total-income').textContent = transactionView.formatMoney(totals.income);
    document.querySelector('#total-expense').textContent = transactionView.formatMoney(totals.expense);
    document.querySelector('#income-caption').textContent = `During ${label}`;
    document.querySelector('#expense-caption').textContent = `During ${label}`;
    document.querySelector('#current-balance').textContent = transactionView.formatMoney(balance);
    document.querySelector('#current-balance').classList.toggle('amount--expense', balance < 0);
    document.querySelector('#current-balance').classList.toggle('amount--income', balance >= 0);
    document.querySelector('#balance-caption').textContent = balance < 0
      ? `Expenses exceed income · ${label}` : `Income minus expenses · ${label}`;
    document.querySelector('#period-count').textContent = String(transactions.length);
    document.querySelector('#period-count-caption').textContent = label === 'Overall'
      ? 'Across all recorded dates' : `For ${label}`;
  }

  function updateCategoryFilter() {
    const selected = historyCategory.value || 'all';
    const categories = Array.from(new Set(store.getTransactions().map((transaction) => transaction.category)))
      .sort((a, b) => a.localeCompare(b));
    historyCategory.replaceChildren();
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All categories';
    historyCategory.append(allOption);
    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      historyCategory.append(option);
    });
    historyCategory.value = categories.includes(selected) ? selected : 'all';
  }

  function updateHistoryPeriodControls() {
    document.querySelector('#history-month-control').hidden = historyPeriod.value !== 'monthly';
    document.querySelector('#history-year-control').hidden = historyPeriod.value !== 'yearly';
    document.querySelector('#history-anchor-control').hidden = historyPeriod.value !== 'weekly' && historyPeriod.value !== 'today';
    document.querySelector('#history-range-controls').hidden = historyPeriod.value !== 'custom';
  }

  // Combine History's date, type, and category filters for the transaction table.
  function getVisibleTransactions() {
    const mode = historyPeriod.value;
    let start = '';
    let end = '';
    if (mode === 'monthly') {
      const month = historyMonthInput.value;
      if (!month) return [];
      const [year, monthNumber] = month.split('-').map(Number);
      start = `${month}-01`;
      end = localDateValue(new Date(year, monthNumber, 0));
    } else if (mode === 'yearly') {
      if (!historyYearInput.value) return [];
      start = `${historyYearInput.value}-01-01`;
      end = `${historyYearInput.value}-12-31`;
    } else if (mode === 'weekly' || mode === 'today') {
      if (!historyAnchorInput.value) return [];
      if (mode === 'today') {
        start = historyAnchorInput.value;
        end = historyAnchorInput.value;
      } else {
        const week = getWeekRange(historyAnchorInput.value);
        start = week.start;
        end = week.end;
      }
    } else if (mode === 'custom') {
      start = historyStartInput.value;
      end = historyEndInput.value;
      if (start && end && start > end) [start, end] = [end, start];
    }
    return store.getTransactions().filter((transaction) =>
      (!start || transaction.date >= start)
      && (!end || transaction.date <= end)
      && (historyType.value === 'all' || transaction.type === historyType.value)
      && (historyCategory.value === 'all' || transaction.category === historyCategory.value)
    );
  }

  function renderCategoryLegend(transactions) {
    const container = document.querySelector('#category-breakdown');
    const totals = new Map();
    transactions.filter((transaction) => transaction.type === 'expense').forEach((transaction) => {
      totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amount);
    });
    const categories = Array.from(totals, ([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    container.replaceChildren();

    if (categories.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted-message';
      empty.textContent = 'No expenses match these filters.';
      container.append(empty);
      return categories;
    }

    categories.forEach((category, index) => {
      const item = document.createElement('div');
      item.className = 'category-item';
      const label = document.createElement('div');
      label.className = 'category-name';
      const swatch = document.createElement('span');
      swatch.className = 'category-swatch';
      swatch.style.backgroundColor = palette[index % palette.length];
      const name = document.createElement('span');
      name.textContent = category.name;
      label.append(swatch, name);
      const value = document.createElement('span');
      value.className = 'category-value';
      value.textContent = transactionView.formatMoney(category.amount);
      item.append(label, value);
      container.append(item);
    });
    return categories;
  }

  function renderCategoryChart(categories) {
    const canvas = document.querySelector('#category-chart');
    const fallback = document.querySelector('#chart-fallback');
    const chartData = {
      labels: categories.map((category) => category.name),
      datasets: [{
        data: categories.map((category) => category.amount),
        backgroundColor: categories.map((_, index) => palette[index % palette.length]),
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-chart-separator').trim() || '#ffffff',
        borderWidth: 3,
        hoverOffset: 5
      }]
    };

    if (typeof window.Chart !== 'function') {
      fallback.hidden = categories.length === 0;
      canvas.hidden = true;
      return;
    }

    fallback.hidden = true;
    canvas.hidden = false;
    if (!categoryChart) {
      categoryChart = new window.Chart(canvas, {
        type: 'doughnut',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (context) => ` ${context.label}: ${transactionView.formatMoney(context.raw)}` } }
          }
        }
      });
      return;
    }
    categoryChart.data.labels = chartData.labels;
    categoryChart.data.datasets[0].data = chartData.datasets[0].data;
    categoryChart.data.datasets[0].backgroundColor = chartData.datasets[0].backgroundColor;
    categoryChart.data.datasets[0].borderColor = chartData.datasets[0].borderColor;
    categoryChart.update();
  }

  function updateDetailsCategoryOptions() {
    const selected = detailsCategoryFilter.value || 'all';
    const savedCategories = store.getTransactions({ type: detailsType }).map((transaction) => transaction.category);
    const categories = Array.from(new Set([...categoriesByType[detailsType], ...savedCategories]))
      .sort((a, b) => a.localeCompare(b));
    detailsCategoryFilter.replaceChildren();
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All categories';
    detailsCategoryFilter.append(allOption);
    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      detailsCategoryFilter.append(option);
    });
    detailsCategoryFilter.value = categories.includes(selected) ? selected : 'all';
  }

  function getDetailsTransactions() {
    const category = detailsCategoryFilter.value;
    let start = detailsStartFilter.value;
    let end = detailsEndFilter.value;
    if (start && end && start > end) [start, end] = [end, start];
    return store.getTransactions({ type: detailsType }).filter((transaction) =>
      (category === 'all' || transaction.category === category)
      && (!start || transaction.date >= start)
      && (!end || transaction.date <= end)
    );
  }

  function renderDetailsBreakdown(categories) {
    detailsBreakdown.replaceChildren();
    if (categories.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted-message';
      empty.textContent = 'No category totals match these filters.';
      detailsBreakdown.append(empty);
      return;
    }
    categories.forEach((category, index) => {
      const item = document.createElement('div');
      item.className = 'category-item';
      const label = document.createElement('div');
      label.className = 'category-name';
      const swatch = document.createElement('span');
      swatch.className = 'category-swatch';
      swatch.style.backgroundColor = palette[index % palette.length];
      const name = document.createElement('span');
      name.textContent = category.name;
      label.append(swatch, name);
      const amount = document.createElement('span');
      amount.className = 'category-value';
      amount.textContent = transactionView.formatMoney(category.amount);
      item.append(label, amount);
      detailsBreakdown.append(item);
    });
  }

  function renderDetailsChart(transactions) {
    const totals = new Map();
    transactions.forEach((transaction) => {
      totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amount);
    });
    const categories = Array.from(totals, ([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    const chartData = {
      labels: categories.map((category) => category.name),
      datasets: [{
        data: categories.map((category) => category.amount),
        backgroundColor: categories.map((_, index) => palette[index % palette.length]),
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-chart-separator').trim() || '#ffffff',
        borderWidth: 3,
        hoverOffset: 5
      }]
    };

    renderDetailsBreakdown(categories);
    const chartUnavailable = typeof window.Chart !== 'function';
    detailsChartFallback.hidden = !chartUnavailable && categories.length > 0;
    detailsChartFallback.textContent = chartUnavailable
      ? 'Chart.js did not load. Category totals are listed here.'
      : 'No category totals match these filters.';
    detailsChartCanvas.hidden = chartUnavailable || categories.length === 0;
    if (chartUnavailable) return;

    if (!detailsChart) {
      if (categories.length === 0) return;
      detailsChart = new window.Chart(detailsChartCanvas, {
        type: 'doughnut',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          animation: { duration: 240 },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (context) => ` ${context.label}: ${transactionView.formatMoney(context.raw)}` } }
          }
        }
      });
      return;
    }
    detailsChart.data.labels = chartData.labels;
    detailsChart.data.datasets[0].data = chartData.datasets[0].data;
    detailsChart.data.datasets[0].backgroundColor = chartData.datasets[0].backgroundColor;
    detailsChart.data.datasets[0].borderColor = chartData.datasets[0].borderColor;
    detailsChart.update();
    if (categories.length > 0) detailsChart.resize();
  }

  function renderDetailsTransactions(transactions) {
    detailsRows.replaceChildren();
    detailsCount.textContent = `${transactions.length} ${transactions.length === 1 ? 'transaction' : 'transactions'}`;
    if (transactions.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.className = 'empty-row';
      cell.textContent = 'No transactions match these filters.';
      row.append(cell);
      detailsRows.append(row);
      return;
    }
    transactions.forEach((transaction) => {
      const row = document.createElement('tr');
      const date = document.createElement('td');
      const category = document.createElement('td');
      const description = document.createElement('td');
      const amount = document.createElement('td');
      const actions = document.createElement('td');
      const [year, month, day] = transaction.date.split('-').map(Number);
      date.textContent = new Intl.DateTimeFormat('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      }).format(new Date(year, month - 1, day));
      category.textContent = transaction.category;
      description.textContent = transaction.description || (detailsType === 'income' ? 'Income' : 'Expense');
      amount.textContent = `${detailsType === 'income' ? '+' : '−'}${transactionView.formatMoney(transaction.amount)}`;
      amount.className = `amount amount--${detailsType}`;

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'icon-button icon-button--edit';
      editButton.dataset.editId = transaction.id;
      editButton.setAttribute('aria-label', `Edit ${detailsType} transaction`);
      editButton.textContent = 'Edit';
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'icon-button';
      deleteButton.dataset.deleteId = transaction.id;
      deleteButton.setAttribute('aria-label', `Delete ${detailsType} transaction`);
      deleteButton.textContent = 'Delete';
      actions.append(editButton, deleteButton);
      row.append(date, category, description, amount, actions);
      detailsRows.append(row);
    });
  }

  function renderDetails() {
    if (!detailsDialog.open) return;
    updateDetailsCategoryOptions();
    const transactions = getDetailsTransactions();
    detailsTotal.textContent = transactionView.formatMoney(
      transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
    );
    renderDetailsChart(transactions);
    renderDetailsTransactions(transactions);
  }

  function openDetails(type, trigger, dateRange) {
    detailsType = type;
    detailsTrigger = trigger;
    const label = type === 'income' ? 'Income' : 'Expense';
    detailsTitle.textContent = `${label} Details`;
    detailsDescription.textContent = `${label} transactions`;
    detailsCategoryFilter.value = 'all';
    const selection = getDashboardSelection();
    detailsStartFilter.value = dateRange?.start ?? selection.start;
    detailsEndFilter.value = dateRange?.end ?? selection.end;
    updateDetailsCategoryOptions();
    detailsDialog.showModal();
    renderDetails();
  }

  function handleSummaryCardKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openDetails(event.currentTarget.dataset.detailsType, event.currentTarget);
  }

  function drawActivityChart(selection) {
    const canvas = document.querySelector('#trend-chart');
    const context = canvas.getContext('2d');
    if (!context) return;

    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(bounds.width * pixelRatio);
    canvas.height = Math.round(bounds.height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const width = bounds.width;
    const height = bounds.height;
    const padding = { top: 12, right: 7, bottom: 25, left: 46 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    let start = selection.start;
    let end = selection.end;
    if (!start || !end) {
      const dates = selection.transactions.map((transaction) => transaction.date).sort();
      start = start || dates[0] || localDateValue(new Date(now.getFullYear(), 0, 1));
      end = end || dates[dates.length - 1] || localDateValue(new Date(now.getFullYear(), 11, 31));
    }
    const startDate = dateParts(start);
    const endDate = dateParts(end);
    const spanDays = Math.round((endDate - startDate) / 86400000) + 1;
    const monthly = selection.mode === 'yearly' || spanDays > 35;
    const buckets = [];
    if (monthly) {
      const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      while (cursor <= lastMonth) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(cursor);
        buckets.push({ key, start: `${key}-01`, end: localDateValue(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)), label: cursor.getFullYear() === startDate.getFullYear()
          && cursor.getFullYear() === endDate.getFullYear() ? monthLabel : `${monthLabel} '${String(cursor.getFullYear()).slice(-2)}`,
        income: 0, expense: 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const cursor = new Date(startDate);
      for (let index = 0; index < spanDays; index += 1) {
        const key = localDateValue(cursor);
        buckets.push({ key, start: key, end: key, label: spanDays <= 7
          ? new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(cursor)
          : String(cursor.getDate()), income: 0, expense: 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    selection.transactions.forEach((transaction) => {
      const key = monthly ? transaction.date.slice(0, 7) : transaction.date;
      const bucket = bucketByKey.get(key);
      if (bucket) bucket[transaction.type] += transaction.amount;
    });
    const maximum = Math.max(1, ...buckets.flatMap((bucket) => [bucket.income, bucket.expense]));
    const roundedMaximum = Math.pow(10, Math.ceil(Math.log10(maximum)));
    const step = roundedMaximum / 4;
    const styles = getComputedStyle(document.documentElement);
    const axisColor = styles.getPropertyValue('--color-chart-grid').trim() || '#e9edf3';
    const labelColor = styles.getPropertyValue('--color-chart-label').trim() || '#99a3b3';
    const incomeColor = styles.getPropertyValue('--color-income').trim() || '#20a778';
    const expenseColor = styles.getPropertyValue('--color-expense').trim() || '#e36b69';
    activityChartSelection = { selection, buckets, monthly, padding, plotWidth, plotHeight, width, height };

    context.clearRect(0, 0, width, height);
    context.font = '10px "DM Sans", sans-serif';
    context.textBaseline = 'middle';
    context.strokeStyle = axisColor;
    context.fillStyle = labelColor;
    context.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
      const y = padding.top + (plotHeight * index) / 4;
      const value = roundedMaximum - step * index;
      context.beginPath();
      context.moveTo(padding.left, y + 0.5);
      context.lineTo(width - padding.right, y + 0.5);
      context.stroke();
      context.textAlign = 'right';
      context.fillText(value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${Math.round(value)}`, padding.left - 8, y);
    }

    const groupWidth = plotWidth / buckets.length;
    const barWidth = Math.max(1, Math.min(8, groupWidth * 0.31));
    buckets.forEach((bucket, index) => {
      const center = padding.left + (index + 0.5) * groupWidth;
      if (index === activityHoveredIndex) {
        context.fillStyle = 'rgba(101, 88, 232, .07)';
        context.fillRect(padding.left + index * groupWidth, padding.top, groupWidth, plotHeight);
      }
      const incomeHeight = (bucket.income / roundedMaximum) * plotHeight;
      const expenseHeight = (bucket.expense / roundedMaximum) * plotHeight;
      context.fillStyle = incomeColor;
      context.fillRect(center - barWidth - 1, padding.top + plotHeight - incomeHeight, barWidth, incomeHeight);
      context.fillStyle = expenseColor;
      context.fillRect(center + 1, padding.top + plotHeight - expenseHeight, barWidth, expenseHeight);
    });

    context.fillStyle = labelColor;
    context.textAlign = 'center';
    const labelStep = Math.max(1, Math.ceil(buckets.length / 8));
    buckets.forEach((bucket, index) => {
      if (index % labelStep !== 0 && index !== buckets.length - 1) return;
      const x = padding.left + (index + 0.5) * groupWidth;
      context.fillText(bucket.label, x, height - 10);
    });
    canvas.setAttribute('aria-label', `${monthly ? 'Monthly' : 'Daily'} income and expenses for ${selection.label}.`);
  }

  function showActivityBucket(index, pointerX) {
    const chart = activityChartSelection;
    if (!chart || index < 0 || index >= chart.buckets.length) return;
    activityHoveredIndex = index;
    const bucket = chart.buckets[index];
    const tooltip = document.querySelector('#chart-tooltip');
    document.querySelector('#chart-tooltip-period').textContent = chart.monthly
      ? `${bucket.label} ${bucket.start.slice(0, 4)}` : formatShortDate(bucket.start);
    document.querySelector('#chart-tooltip-income').textContent = transactionView.formatMoney(bucket.income);
    document.querySelector('#chart-tooltip-expense').textContent = transactionView.formatMoney(bucket.expense);
    tooltip.hidden = false;
    const tooltipHalfWidth = tooltip.offsetWidth / 2;
    const centerX = pointerX ?? chart.padding.left + ((index + 0.5) * chart.plotWidth) / chart.buckets.length;
    tooltip.style.left = `${Math.max(tooltipHalfWidth, Math.min(chart.width - tooltipHalfWidth, centerX))}px`;
    drawActivityChart(chart.selection);
  }

  function hideActivityTooltip() {
    activityHoveredIndex = -1;
    document.querySelector('#chart-tooltip').hidden = true;
    if (activityChartSelection) drawActivityChart(activityChartSelection.selection);
  }

  function openActivityBucket(type) {
    const chart = activityChartSelection;
    if (!chart || activityHoveredIndex < 0) return;
    const bucket = chart.buckets[activityHoveredIndex];
    openDetails(type, document.querySelector('#trend-chart'), { start: bucket.start, end: bucket.end });
  }

  function handleActivityPointer(event) {
    const chart = activityChartSelection;
    if (!chart) return;
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const groupWidth = chart.plotWidth / chart.buckets.length;
    const index = Math.floor((pointerX - chart.padding.left) / groupWidth);
    if (index < 0 || index >= chart.buckets.length) {
      hideActivityTooltip();
      return;
    }
    activityActiveType = pointerX < chart.padding.left + ((index + 0.5) * chart.plotWidth) / chart.buckets.length
      ? 'income' : 'expense';
    if (index !== activityHoveredIndex) showActivityBucket(index, pointerX);
  }

  function handleActivityKeydown(event) {
    const chart = activityChartSelection;
    if (!chart || !chart.buckets.length) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const currentIndex = activityHoveredIndex < 0 ? 0 : activityHoveredIndex;
      const nextIndex = Math.max(0, Math.min(chart.buckets.length - 1, currentIndex + direction));
      showActivityBucket(nextIndex);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      activityActiveType = event.key === 'ArrowUp' ? 'income' : 'expense';
    } else if (event.key === 'Enter' && activityHoveredIndex >= 0) {
      event.preventDefault();
      openActivityBucket(activityActiveType);
    } else if (event.key === 'Escape') {
      hideActivityTooltip();
    }
  }

  // Refresh dashboard summaries, charts, and History after state or filter changes.
  function render() {
    updatePeriodControls();
    updateHistoryPeriodControls();
    const selection = getDashboardSelection();
    updateCategoryFilter();
    const historyTransactions = getVisibleTransactions();
    const transactions = selection.transactions;
    document.querySelector('#chart-title').textContent = `${selection.label} activity`;
    document.querySelector('#chart-caption').textContent = transactions.length
      ? `${transactions.length} ${transactions.length === 1 ? 'entry' : 'entries'} shown for ${selection.label}.`
      : `No transactions match ${selection.label.toLowerCase()}.`;
    document.querySelector('#transaction-count').textContent = `${historyTransactions.length} ${historyTransactions.length === 1 ? 'entry' : 'entries'}`;
    document.querySelector('#filter-result-count').textContent = `${historyTransactions.length} shown`;
    renderSummary(transactions, selection.label);
    const categories = renderCategoryLegend(transactions);
    renderCategoryChart(categories);
    transactionView.render(rows, historyTransactions);
    drawActivityChart(selection);
    renderDetails();

    const displayName = store.getState().profile?.name || currentSession.username || 'Guest';
    document.querySelector('#profile-name').textContent = displayName;
    document.querySelector('#profile-avatar').textContent = displayName.charAt(0).toUpperCase();
  }

  function activateTab(tab) {
    const viewName = tab.dataset.view;
    document.querySelectorAll('.main-tab').forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.app-view').forEach((view) => {
      const viewIsActive = view.id === `view-${viewName}`
        || (viewName === 'add-expense' && view.id === 'view-add-transaction')
        || (viewName === 'add-income' && view.id === 'view-add-transaction');
      view.hidden = !viewIsActive;
    });
    if (viewName === 'add-expense' || viewName === 'add-income') {
      const type = viewName === 'add-income' ? 'income' : 'expense';
      transactionType.value = type;
      updateCategoryOptions(transactionCategory, type, categoriesByType[type][0]);
      document.querySelector('#entry-title').textContent = 'Add Transaction';
      document.querySelector('#view-add-transaction').setAttribute('aria-labelledby', tab.id);
      document.querySelector('#transaction-amount').focus();
    }
    if (viewName === 'dashboard' && categoryChart) categoryChart.resize();
  }

  setupPeriodControls();
  themeToggle.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
    render();
  });
  updateCategoryOptions(transactionCategory, transactionType.value);
  updateCategoryOptions(editCategory, editType.value);
  store.subscribe(render);
  render();
  const activityCanvas = document.querySelector('#trend-chart');
  activityCanvas.addEventListener('pointermove', handleActivityPointer);
  activityCanvas.addEventListener('pointerdown', handleActivityPointer);
  activityCanvas.addEventListener('pointerleave', hideActivityTooltip);
  activityCanvas.addEventListener('click', () => openActivityBucket(activityActiveType));
  activityCanvas.addEventListener('keydown', handleActivityKeydown);
  [incomeSummaryCard, expenseSummaryCard].forEach((card) => {
    card.addEventListener('click', () => openDetails(card.dataset.detailsType, card));
    card.addEventListener('keydown', handleSummaryCardKeydown);
  });
  detailsCategoryFilter.addEventListener('change', renderDetails);
  detailsStartFilter.addEventListener('change', renderDetails);
  detailsEndFilter.addEventListener('change', renderDetails);
  document.querySelector('#details-reset-filters').addEventListener('click', () => {
    detailsCategoryFilter.value = 'all';
    detailsStartFilter.value = '';
    detailsEndFilter.value = '';
    renderDetails();
  });
  document.querySelector('#details-close').addEventListener('click', () => detailsDialog.close());
  detailsDialog.addEventListener('close', () => detailsTrigger?.focus());
  const dashboardTab = document.querySelector('#tab-dashboard');
  dashboardTab.tabIndex = 0;
  document.querySelectorAll('.main-tab').forEach((tab) => {
    tab.tabIndex = tab === dashboardTab ? 0 : -1;
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const tabs = Array.from(document.querySelectorAll('.main-tab'));
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextTab = tabs[(tabs.indexOf(tab) + direction + tabs.length) % tabs.length];
      nextTab.focus();
      activateTab(nextTab);
    });
  });

  monthInput.addEventListener('change', render);
  yearInput.addEventListener('change', render);
  periodModeInput.addEventListener('change', render);
  periodAnchorInput.addEventListener('change', render);
  periodStartInput.addEventListener('change', render);
  periodEndInput.addEventListener('change', render);
  historyType.addEventListener('change', render);
  historyCategory.addEventListener('change', render);
  historyPeriod.addEventListener('change', render);
  historyMonthInput.addEventListener('change', render);
  historyYearInput.addEventListener('change', render);
  historyAnchorInput.addEventListener('change', render);
  historyStartInput.addEventListener('change', render);
  historyEndInput.addEventListener('change', render);
  transactionType.addEventListener('change', () => {
    updateCategoryOptions(transactionCategory, transactionType.value);
  });
  editType.addEventListener('change', () => {
    updateCategoryOptions(editCategory, editType.value);
  });
  window.addEventListener('resize', () => {
    render();
    if (categoryChart) categoryChart.resize();
  });

  form.querySelectorAll('input, select').forEach((input) => {
    input.addEventListener('input', () => setFieldError(input.id, ''));
    input.addEventListener('change', () => setFieldError(input.id, ''));
  });

  // Save validated entries, then focus the dashboard on the saved transaction's month.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    setMessage('', false);
    const transaction = readAndValidate(form, '');
    if (!transaction) return;
    try {
      const saved = store.addTransaction(transaction);
      const [year, month] = saved.date.split('-').map(Number);
      selectPeriod(year, month);
      historyType.value = 'all';
      historyCategory.value = 'all';
      document.querySelector('#transaction-amount').value = '';
      document.querySelector('#transaction-description').value = '';
      updateCategoryOptions(transactionCategory, transactionType.value, categoriesByType[transactionType.value][0]);
      clearErrors(form);
      setMessage('Transaction saved on this device.', true);
      render();
    } catch (error) {
      setMessage(error.message || 'Could not save this transaction.', false);
    }
  });

  function handleTransactionAction(event) {
    const editButton = event.target.closest('[data-edit-id]');
    const deleteButton = event.target.closest('[data-delete-id]');
    if (editButton) {
      const transaction = store.getState().transactions.find((item) => item.id === editButton.dataset.editId);
      if (!transaction) return;
      document.querySelector('#edit-transaction-id').value = transaction.id;
      editType.value = transaction.type;
      updateCategoryOptions(editCategory, transaction.type, transaction.category, true);
      document.querySelector('#edit-amount').value = transaction.amount;
      document.querySelector('#edit-date').value = transaction.date;
      document.querySelector('#edit-category').value = transaction.category;
      document.querySelector('#edit-description').value = transaction.description;
      clearErrors(editForm);
      editDialog.showModal();
      document.querySelector('#edit-amount').focus();
      return;
    }
    if (deleteButton) {
      store.deleteTransaction(deleteButton.dataset.deleteId);
      setMessage('Transaction deleted.', true);
    }
  }

  rows.addEventListener('click', handleTransactionAction);
  detailsRows.addEventListener('click', handleTransactionAction);

  editForm.querySelectorAll('input, select').forEach((input) => {
    input.addEventListener('input', () => setFieldError(input.id, ''));
    input.addEventListener('change', () => setFieldError(input.id, ''));
  });

  editForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const transaction = readAndValidate(editForm, 'edit');
    if (!transaction) return;
    const id = document.querySelector('#edit-transaction-id').value;
    try {
      store.updateTransaction(id, transaction);
      editDialog.close();
      setMessage('Transaction updated.', true);
      render();
    } catch (error) {
      setFieldError('edit-amount', error.message || 'Could not update this transaction.');
    }
  });

  document.querySelector('#cancel-edit').addEventListener('click', () => editDialog.close());
  editDialog.addEventListener('close', () => clearErrors(editForm));

  const profileDialog = document.querySelector('#profile-dialog');
  const profileForm = document.querySelector('#profile-form');
  document.querySelector('#profile-button').addEventListener('click', () => {
    document.querySelector('#display-name-input').value = store.getState().profile?.name || '';
    profileDialog.showModal();
    document.querySelector('#display-name-input').focus();
  });
  document.querySelector('#cancel-profile').addEventListener('click', () => profileDialog.close());
  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    store.setProfileName(new FormData(profileForm).get('displayName'));
    profileDialog.close();
  });

  document.querySelector('#logout-button').addEventListener('click', () => {
    window.localStorage.removeItem('currentUser');
    window.location.replace('./login_signup.html');
  });
})();
