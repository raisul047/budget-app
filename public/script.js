// References
const form = document.getElementById('transactionForm');
const list = document.getElementById('transactionList');
const progress = document.getElementById('budgetProgress');
const budgetForm = document.getElementById('budgetForm');
const budgetGoalsList = document.getElementById('budgetGoalsList');
const userProfile = document.getElementById('userProfile');

// Submit Transaction
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const transaction = {
    type: document.getElementById('type').value,
    amount: parseFloat(document.getElementById('amount').value),
    category: document.getElementById('category').value,
    date: document.getElementById('date').value,
    recurring: document.getElementById('recurring').checked,
    recurringInterval: document.getElementById('recurringInterval').value || null
  };

  try {
    await fetch('/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });

    form.reset();
    loadTransactions();
    loadAnalytics();
    loadGoals();
  } catch (err) {
    console.error("Error submitting transaction:", err);
  }
});

async function loadTransactions() {
  try {
    const res = await fetch('/transactions');
    const transactions = await res.json();
    list.innerHTML = '';

    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      const li = document.createElement('li');
      li.textContent = `${t.type.toUpperCase()}: $${t.amount} (${t.category}) - ${new Date(t.date).toLocaleDateString()}`;

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.onclick = async () => {
        const newAmount = prompt('New amount:', t.amount);
        if (newAmount) {
          try {
            await fetch(`/transaction/${t._id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: parseFloat(newAmount) })
            });
            loadTransactions();
            loadAnalytics();
            loadGoals();
          } catch (err) {
            console.error("Error updating transaction:", err);
          }
        }
      };

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = async () => {
        if (confirm('Delete this transaction?')) {
          try {
            await fetch(`/transaction/${t._id}`, { method: 'DELETE' });
            loadTransactions();
            loadAnalytics();
            loadGoals();
          } catch (err) {
            console.error("Error deleting transaction:", err);
          }
        }
      };

      li.appendChild(editBtn);
      li.appendChild(deleteBtn);
      list.appendChild(li);

      if (t.type === 'income') {
        income += t.amount;
      } else {
        expense += t.amount;
      }
    }

    // Reversed logic: Remaining budget percentage
    const percentage = income === 0 ? 0 : Math.max(0, 100 - (expense / income) * 100);
    progress.value = percentage;

    // Remove existing classes
    progress.classList.remove('green', 'red');

    // Add appropriate color class
    if (percentage < 20) {
      progress.classList.add('red');
    } else {
      progress.classList.add('green');
    }

  } catch (err) {
    console.error("Error loading transactions:", err);
  }
}


// Submit Budget Goal
budgetForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const goals = await fetch('/budget-goals').then(res => res.json());

  goals.push({
    category: document.getElementById('goalCategory').value,
    limit: parseFloat(document.getElementById('goalLimit').value)
  });

  try {
    await fetch('/budget-goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goals)
    });

    budgetForm.reset();
    loadGoals();
  } catch (err) {
    console.error("Error submitting budget goal:", err);
  }
});

// Load Budget Goals with Progress
async function loadGoals() {
  try {
    const goals = await fetch('/budget-goals').then(res => res.json());
    const transactions = await fetch('/transactions').then(res => res.json());

    const expensesByCategory = {};
    for (const tx of transactions) {
      if (tx.type === 'expense') {
        expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + tx.amount;
      }
    }

    budgetGoalsList.innerHTML = '';

    for (const goal of goals) {
      const spent = expensesByCategory[goal.category] || 0;
      const percent = Math.min(100, (spent / goal.limit) * 100).toFixed(1);

      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${goal.category}</strong>: $${spent} / $${goal.limit} (${percent}%)
        <div class="goal-bar">
          <div class="goal-progress" style="width: ${percent}%"></div>
        </div>
      `;
      budgetGoalsList.appendChild(li);
    }
  } catch (err) {
    console.error("Error loading goals:", err);
  }
}

// Load Analytics Chart
async function loadAnalytics() {
  try {
    const transactions = await fetch('/analytics').then(res => res.json());

    const categories = {};
    for (const t of transactions) {
      if (t.type === 'expense') {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      }
    }

    const ctx = document.getElementById('categoryChart').getContext('2d');

    if (window.categoryChartInstance) {
      window.categoryChartInstance.destroy();
    }

    window.categoryChartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(categories),
        datasets: [{
          data: Object.values(categories),
          backgroundColor: [
            '#6a11cb', '#2575fc', '#2ecc71', '#f1c40f', '#e67e22', '#9b59b6'
          ]
        }]
      },
      options: {
        animation: {
          animateScale: true,
          animateRotate: true,
          duration: 1500,
          easing: 'easeOutBounce'
        }
      }
    });
  } catch (err) {
    console.error("Error loading analytics:", err);
  }
}

// Initialize Page
async function initializePage() {
  await loadUserProfile();
  await loadTransactions();
  await loadGoals();
  await loadAnalytics();
}
initializePage();

// Dark Mode Toggle
document.getElementById('toggleDark').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
}

// Load User Profile
async function loadUserProfile() {
  try {
    const res = await fetch('/user');
    const user = await res.json();
    userProfile.textContent = `Welcome, ${user.email}`;
  } catch (err) {
    console.error("Error loading user profile:", err);
  }
}


async function loadUserProfile() {
  try {
    const res = await fetch('/user');
    const user = await res.json();
    userProfile.textContent = `Welcome, ${user.name}`;
  } catch (err) {
    console.error("Error loading user profile:", err);
  }
}


const completedGoalsList = document.getElementById('completedGoalsList');
const uncompletedGoalsList = document.getElementById('uncompletedGoalsList');

completedGoalsList.innerHTML = '';
uncompletedGoalsList.innerHTML = '';

for (const goal of goals) {
  const spent = expensesByCategory[goal.category] || 0;
  const percent = Math.min(100, (spent / goal.limit) * 100).toFixed(1);

  const li = document.createElement('li');
  li.innerHTML = `
    <strong>${goal.category}</strong>: $${spent} / $${goal.limit} (${percent}%)
    <div class="goal-bar">
      <div class="goal-progress" style="width: ${percent}%"></div>
    </div>
  `;

  if (spent >= goal.limit) {
    completedGoalsList.appendChild(li);
  } else {
    uncompletedGoalsList.appendChild(li);
  }
}

async function loadUpcomingExpenses() {
  const list = document.getElementById('upcomingExpensesList');
  list.innerHTML = '';

  const transactions = await fetch('/transactions').then(res => res.json());

  const upcoming = transactions.filter(t => {
    const txDate = new Date(t.date);
    return txDate > new Date();
  });

  for (const t of upcoming) {
    const li = document.createElement('li');
    li.textContent = `${t.category} - $${t.amount} on ${new Date(t.date).toLocaleDateString()}`;
    list.appendChild(li);
  }
}

async function loadGoals() {
  try {
    const goals = await fetch('/budget-goals').then(res => res.json());
    const transactions = await fetch('/transactions').then(res => res.json());

    // Sum expenses per category
    const expensesByCategory = {};
    for (const tx of transactions) {
      if (tx.type === 'expense') {
        expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + tx.amount;
      }
    }

    const completedGoalsList = document.getElementById('completedGoalsList');
    const uncompletedGoalsList = document.getElementById('uncompletedGoalsList');

    completedGoalsList.innerHTML = '';
    uncompletedGoalsList.innerHTML = '';

    for (const goal of goals) {
      const spent = expensesByCategory[goal.category] || 0;
      const remaining = Math.max(0, goal.limit - spent).toFixed(2);
      const percent = Math.min(100, (spent / goal.limit) * 100).toFixed(1);

      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${goal.category}</strong><br>
        Spent: $${spent} / $${goal.limit} (${percent}%)<br>
        Remaining: $${remaining}
        <div class="goal-bar">
          <div class="goal-progress" style="width: ${percent}%"></div>
        </div>
      `;

      if (spent >= goal.limit) {
        completedGoalsList.appendChild(li);
      } else {
        uncompletedGoalsList.appendChild(li);
      }
    }
  } catch (err) {
    console.error("Error loading goals:", err);
  }
}



document.getElementById('toggleDark').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
}


