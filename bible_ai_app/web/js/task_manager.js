/**
 * Task Manager Controller
 * Gère le suivi en temps réel des tâches d'arrière-plan (indexation RAG, vectorisation, téléchargements)
 * et affiche les cartes de progression élégantes et animées en bas à droite de l'écran.
 */

const TaskManager = {
  tasks: {},
  pollTimer: null,
  containerEl: null,

  init() {
    this.containerEl = document.getElementById('global-tasks-overlay');
    if (!this.containerEl) {
      this.createContainer();
    }
    
    // Récupérer les tâches existantes au démarrage
    this.fetchTasks();
  },

  createContainer() {
    let el = document.getElementById('global-tasks-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-tasks-overlay';
      el.className = 'tasks-overlay';
      document.body.appendChild(el);
    }
    this.containerEl = el;
  },

  async fetchTasks() {
    try {
      if (typeof API !== 'undefined' && typeof API.getBackgroundTasks === 'function') {
        const list = await API.getBackgroundTasks();
        if (Array.isArray(list)) {
          list.forEach(task => {
            if (task && (task.status === 'running' || task.status === 'pending')) {
              this.handleTaskEvent('task_updated', task);
            }
          });
        }
      }
    } catch (e) {
      // API peut ne pas être encore prête
    }
  },

  handleTaskEvent(eventType, taskData) {
    if (!taskData || !taskData.id) return;
    
    this.tasks[taskData.id] = taskData;
    this.renderTaskCard(taskData);
    this.updateContainerVisibility();

    if (taskData.status === 'completed') {
      // Si la tâche vient de se terminer avec succès
      setTimeout(() => {
        this.dismissTask(taskData.id);
      }, 5000);

      // Rafraîchir la bibliothèque et le lecteur de théologie si présents
      if (typeof LibraryView !== 'undefined' && typeof LibraryView.loadBooks === 'function') {
        LibraryView.loadBooks();
      }
      if (typeof TheologyView !== 'undefined' && typeof TheologyView.loadBooksList === 'function') {
        TheologyView.loadBooksList();
      }
    }

    this.checkPollingState();
  },

  renderTaskCard(task) {
    if (!this.containerEl) this.createContainer();

    let card = document.getElementById(`task-card-${task.id}`);
    const isNew = !card;

    if (isNew) {
      card = document.createElement('div');
      card.id = `task-card-${task.id}`;
      card.className = 'task-card';
      this.containerEl.appendChild(card);
    }

    // Classes d'état
    card.classList.toggle('is-completed', task.status === 'completed');
    card.classList.toggle('is-error', task.status === 'error');

    const isRunning = task.status === 'running';
    const isCompleted = task.status === 'completed';
    const isError = task.status === 'error';

    const iconHtml = isCompleted
      ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : (isError
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
        : `<span class="synth-spinner" style="width: 14px; height: 14px; border-width: 2px; border-color: rgba(245, 158, 11, 0.3); border-top-color: #f59e0b;"></span>`);

    const typeLabel = task.type === 'rag_indexing' ? 'Vectorisation RAG' : 'Arrière-plan';

    card.innerHTML = `
      <div class="task-card-header">
        <div class="task-icon-wrap">${iconHtml}</div>
        <div class="task-title-wrap" title="${task.title || 'Tâche'}">
          <span class="task-title-text">${task.title || 'Tâche en cours'}</span>
        </div>
        <button class="task-close-btn" onclick="TaskManager.dismissTask('${task.id}')" title="Masquer la notification">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="task-detail-text">${task.detail || ''}</div>
      <div class="task-progress-track">
        <div class="task-progress-bar" style="width: ${task.progress || 0}%;"></div>
      </div>
      <div class="task-footer-info">
        <span class="task-pct-value">${task.progress || 0}%</span>
        <span class="task-scope-tag">${typeLabel}</span>
      </div>
    `;
  },

  async dismissTask(taskId) {
    const card = document.getElementById(`task-card-${taskId}`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(12px) scale(0.96)';
      setTimeout(() => {
        card.remove();
        delete this.tasks[taskId];
        this.updateContainerVisibility();
      }, 300);
    } else {
      delete this.tasks[taskId];
      this.updateContainerVisibility();
    }

    try {
      if (typeof API !== 'undefined' && typeof API.dismissBackgroundTask === 'function') {
        await API.dismissBackgroundTask(taskId);
      }
    } catch (e) {}

    this.checkPollingState();
  },

  updateContainerVisibility() {
    if (!this.containerEl) return;
    const hasCards = this.containerEl.children.length > 0;
    this.containerEl.classList.toggle('hidden', !hasCards);
  },

  checkPollingState() {
    const hasRunning = Object.values(this.tasks).some(t => t.status === 'running');
    if (hasRunning && !this.pollTimer) {
      this.pollTimer = setInterval(() => {
        this.fetchTasks();
      }, 1500);
    } else if (!hasRunning && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
};

// Exposition globale pour pywebview evaluate_js
window.TaskManager = TaskManager;
