
// transactions.js - Renders the transactions table and formats amounts as currency.
(function () {
  'use strict';

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  });

  function formatMoney(amount) {
    return formatter.format(Number(amount) || 0);
  }

  function render(container, transactions) {
    container.replaceChildren();

    // Keep the table structure consistent when filters return no transactions.
    if (transactions.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.className = 'empty-row';
      cell.textContent = 'No transactions for this period yet.';
      row.append(cell);
      container.append(row);
      return;
    }

    // Build cells with textContent so saved descriptions are rendered as text.
    transactions.forEach((transaction) => {
      const row = document.createElement('tr');
      const date = document.createElement('td');
      const detail = document.createElement('td');
      const category = document.createElement('td');
      const type = document.createElement('td');
      const amount = document.createElement('td');
      const actions = document.createElement('td');
      const typeLabel = transaction.type === 'income' ? 'Income' : 'Expense';
      const dateParts = transaction.date.split('-').map(Number);
      const localDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

      date.textContent = new Intl.DateTimeFormat('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      }).format(localDate);
      detail.textContent = transaction.description || typeLabel;
      category.textContent = transaction.category;
      const badge = document.createElement('span');
      badge.className = `type-badge type-badge--${transaction.type}`;
      badge.textContent = typeLabel;
      type.append(badge);
      amount.textContent = `${transaction.type === 'income' ? '+' : '−'}${formatMoney(transaction.amount)}`;
      amount.className = `amount amount--${transaction.type}`;

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'icon-button icon-button--edit';
      editButton.dataset.editId = transaction.id;
      editButton.setAttribute('aria-label', `Edit ${typeLabel.toLowerCase()} transaction`);
      editButton.textContent = 'Edit';

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'icon-button';
      removeButton.dataset.deleteId = transaction.id;
      removeButton.setAttribute('aria-label', `Delete ${typeLabel.toLowerCase()} transaction`);
      removeButton.textContent = 'Delete';
      actions.append(editButton, removeButton);
      row.append(date, detail, category, type, amount, actions);
      container.append(row);
    });
  }

  window.ExITransactions = Object.freeze({ render, formatMoney });
})();
