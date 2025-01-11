import { supabase } from "./config.js";
import { checkAuth } from "./auth.js";

// Initialize tasks
export let tasks = {
  todo: [],
  doing: [],
  completed: [],
};

// Initialize the board
export function initializeBoard() {
  Object.keys(tasks).forEach((column) => {
    const columnEl = document.querySelector(`#${column} .tasks`);
    columnEl.innerHTML = "";
    tasks[column].forEach((task, index) => {
      columnEl.appendChild(createTaskElement(task, column, index));
    });
  });
}

// Create a new task element
function createTaskElement(task, column, index) {
  const taskEl = document.createElement("div");
  taskEl.className = "task";
  taskEl.draggable = true;
  taskEl.id = task.id;

  const dateOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const createdDate = new Date(task.created_at).toLocaleString(
    "en-GB",
    dateOptions
  );
  const completedDate = task.completed_at
    ? new Date(task.completed_at).toLocaleString("en-GB", dateOptions)
    : "";

  // Add move back button only for completed tasks
  const moveBackButton =
    column === "completed"
      ? `<button class="move-back-btn" onclick="window.moveBack('${task.id}')">← Move Back</button>`
      : "";

  taskEl.innerHTML = `
    <div class="task-number">${index + 1}</div>
    <div class="task-content-wrapper">
      <span class="task-content">${task.content}</span>
      <div class="task-buttons">
        ${moveBackButton}
        <button class="edit-btn" onclick="window.editTask('${
          task.id
        }')">Edit</button>
        <button class="delete-btn" onclick="window.deleteTask('${
          task.id
        }', '${column}')">Delete</button>
      </div>
      <div class="task-timestamps">
        <small>Created: ${createdDate}</small>
        ${task.completed_at ? `<small>Completed: ${completedDate}</small>` : ""}
      </div>
    </div>
  `;

  // Desktop drag events
  taskEl.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", task.id);
    taskEl.classList.add("dragging");
  });

  taskEl.addEventListener("dragend", () => {
    taskEl.classList.remove("dragging");
  });

  // Mobile touch events
  let touchStartY = 0;
  let currentY = 0;
  let initialTouch = null;
  let clonedTask = null;
  let isDragging = false;
  let touchStartTime = 0;

  taskEl.addEventListener(
    "touchstart",
    (e) => {
      // Don't prevent default immediately to allow button clicks
      touchStartTime = Date.now();
      touchStartY = e.touches[0].clientY;
      initialTouch = e.touches[0];
    },
    { passive: true }
  );

  taskEl.addEventListener(
    "touchmove",
    (e) => {
      // Only start dragging if the touch has moved more than 10px
      if (!isDragging && Math.abs(e.touches[0].clientY - touchStartY) > 10) {
        isDragging = true;
        e.preventDefault();

        // Create clone for visual feedback
        clonedTask = taskEl.cloneNode(true);
        clonedTask.classList.add("dragging");
        clonedTask.style.position = "fixed";
        clonedTask.style.width = `${taskEl.offsetWidth}px`;
        clonedTask.style.left = `${taskEl.getBoundingClientRect().left}px`;
        clonedTask.style.top = `${
          e.touches[0].clientY - taskEl.offsetHeight / 2
        }px`;
        clonedTask.style.zIndex = "1000";
        document.body.appendChild(clonedTask);

        taskEl.style.opacity = "0.5";
        window.currentDraggedTask = task.id;
      }

      if (isDragging) {
        e.preventDefault();
        const touch = e.touches[0];
        currentY = touch.clientY;

        // Move the cloned element
        if (clonedTask) {
          clonedTask.style.top = `${currentY - taskEl.offsetHeight / 2}px`;
        }

        // Find potential drop target
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetTask = target?.closest(".task");
        const targetColumn = target?.closest(".column");

        // Remove existing highlights
        document.querySelectorAll(".column").forEach((col) => {
          col.classList.remove("drag-over");
        });
        document.querySelectorAll(".drop-marker").forEach((m) => m.remove());

        if (targetColumn) {
          targetColumn.classList.add("drag-over");

          if (targetTask && targetTask !== taskEl) {
            const rect = targetTask.getBoundingClientRect();
            const dropPosition = currentY < rect.top + rect.height / 2;

            // Add drop marker
            const marker = document.createElement("div");
            marker.className = "drop-marker";

            if (dropPosition) {
              targetTask.parentNode.insertBefore(marker, targetTask);
            } else {
              targetTask.parentNode.insertBefore(
                marker,
                targetTask.nextSibling
              );
            }
          }
        }
      }
    },
    { passive: false }
  );

  taskEl.addEventListener("touchend", async (e) => {
    // Only handle drop if we were dragging
    if (isDragging) {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const dropTarget = document.elementFromPoint(
        touch.clientX,
        touch.clientY
      );
      const targetTask = dropTarget?.closest(".task");
      const newColumn = dropTarget?.closest(".column");

      if (clonedTask) {
        clonedTask.remove();
      }
      taskEl.style.opacity = "";

      if (newColumn) {
        const sourceColumn = taskEl.closest(".column").id;
        const tasksContainer = newColumn.querySelector(".tasks");

        if (sourceColumn === newColumn.id) {
          // Same column reordering
          if (targetTask && targetTask !== taskEl) {
            const dropPosition =
              touch.clientY <
              targetTask.getBoundingClientRect().top +
                targetTask.offsetHeight / 2;
            tasksContainer.insertBefore(
              taskEl,
              dropPosition ? targetTask : targetTask.nextSibling
            );

            // Update positions
            const orderedTasks = Array.from(tasksContainer.children)
              .filter((el) => el.classList.contains("task"))
              .map((taskEl, index) => {
                const existingTask = tasks[newColumn.id].find(
                  (t) => t.id === taskEl.id
                );
                return {
                  ...existingTask,
                  position: index,
                  status: newColumn.id,
                };
              });

            await supabase.from("tasks").upsert(orderedTasks);
            tasks[newColumn.id] = orderedTasks;
            initializeBoard();
          }
        } else {
          // Moving to different column
          await updateTaskStatus(window.currentDraggedTask, newColumn.id);
        }
      }

      // Clean up
      document.querySelectorAll(".column").forEach((col) => {
        col.classList.remove("drag-over");
      });
      document.querySelectorAll(".drop-marker").forEach((m) => m.remove());
      window.currentDraggedTask = null;
    }

    // Reset variables
    isDragging = false;
    if (clonedTask) {
      clonedTask.remove();
      clonedTask = null;
    }
    taskEl.style.opacity = "";
    window.currentDraggedTask = null;
  });

  // Add click handler for task content to start edit
  taskEl.querySelector(".task-content").addEventListener("click", (e) => {
    if (!isDragging) {
      window.editTask(task.id);
    }
  });

  return taskEl;
}

// Load tasks from Supabase
export async function loadTasks() {
  if (!checkAuth()) return;

  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("position", { ascending: true });

    if (error) throw error;

    // Group tasks by status
    tasks = {
      todo: data
        .filter((task) => task.status === "todo")
        .sort((a, b) => a.position - b.position),
      doing: data
        .filter((task) => task.status === "doing")
        .sort((a, b) => a.position - b.position),
      completed: data
        .filter((task) => task.status === "completed")
        .sort((a, b) => a.position - b.position),
    };

    initializeBoard();
  } catch (error) {
    console.error("Error loading tasks:", error);
  }
}

// Save task to Supabase
export async function saveTask() {
  const content = document.getElementById("taskInput").value.trim();
  const currentTaskId = window.currentTaskId;
  const currentColumn = window.currentColumn;

  if (content) {
    try {
      if (currentTaskId) {
        // Update existing task
        const { error } = await supabase
          .from("tasks")
          .update({ content: content })
          .eq("id", currentTaskId);

        if (error) throw error;
      } else {
        // Get max position for the column
        const maxPosition = tasks[currentColumn].reduce(
          (max, task) => Math.max(max, task.position || 0),
          -1
        );

        // Add new task
        const { error } = await supabase.from("tasks").insert([
          {
            content: content,
            status: currentColumn,
            created_at: new Date().toISOString(),
            completed_at: null,
            position: maxPosition + 1,
          },
        ]);

        if (error) {
          console.error("Insert Error Details:", error);
          throw error;
        }
      }

      await loadTasks();
      window.closeModal();
    } catch (error) {
      console.error("Error saving task:", error);
      alert(`Failed to save task: ${error.message}`);
    }
  }
}

// Delete task from Supabase
export async function deleteTask(taskId, column) {
  if (confirm("Are you sure you want to delete this task?")) {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) throw error;
      await loadTasks(); // Reload tasks
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  }
}

// Update task status in Supabase
export async function updateTaskStatus(taskId, newStatus) {
  try {
    // Get the maximum position in the target column
    const maxPosition = tasks[newStatus].reduce(
      (max, task) => Math.max(max, task.position || 0),
      -1
    );

    const updates = {
      status: newStatus,
      position: maxPosition + 1,
    };

    if (newStatus === "completed") {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }

    const { error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId);

    if (error) throw error;
    await loadTasks();
  } catch (error) {
    console.error("Error updating task status:", error);
  }
}

// Handle drop
export async function drop(e) {
  e.preventDefault();
  const taskId = e.dataTransfer.getData("text/plain");
  const draggedTask = document.getElementById(taskId);
  if (!draggedTask) return;

  const dropTarget = e.target.closest(".task") || e.target.closest(".tasks");
  if (!dropTarget) return;

  const newColumn = dropTarget.closest(".column").id;
  const sourceColumn = draggedTask.closest(".column").id;
  const tasksContainer = dropTarget.closest(".tasks");

  try {
    if (sourceColumn === newColumn) {
      // Same column reordering
      const targetTask = e.target.closest(".task");

      // Move the task in DOM
      if (!targetTask || targetTask === draggedTask) {
        tasksContainer.appendChild(draggedTask);
      } else {
        const dropPosition =
          e.clientY <
          targetTask.getBoundingClientRect().top + targetTask.offsetHeight / 2;
        targetTask.parentNode.insertBefore(
          draggedTask,
          dropPosition ? targetTask : targetTask.nextSibling
        );
      }

      // Get current tasks in this column with their content
      const orderedTasks = Array.from(tasksContainer.children)
        .filter((el) => el.classList.contains("task"))
        .map((taskEl, index) => {
          const existingTask = tasks[newColumn].find((t) => t.id === taskEl.id);
          return {
            ...existingTask,
            position: index,
            status: newColumn,
          };
        });

      // Update all positions at once
      const { error } = await supabase.from("tasks").upsert(orderedTasks);
      if (error) throw error;

      // Update local tasks array
      tasks[newColumn] = orderedTasks;

      // Reload the board to show new order
      initializeBoard();
    } else {
      // Moving to different column
      await updateTaskStatus(taskId, newColumn);
    }

    // Clean up
    document.querySelectorAll(".drop-marker").forEach((m) => m.remove());
    draggedTask.classList.remove("dragging");
  } catch (error) {
    console.error("Error updating task positions:", error);
    // Restore original state
    await loadTasks();
  }
}

// Add this function to handle drag over effects
export function handleDragOver(e) {
  e.preventDefault();
  const draggedTask = document.querySelector(".dragging");
  if (!draggedTask) return;

  const container = e.target.closest(".tasks");
  const targetTask = e.target.closest(".task");

  // Remove existing drop markers
  document.querySelectorAll(".drop-marker").forEach((m) => m.remove());

  if (targetTask && targetTask !== draggedTask) {
    const rect = targetTask.getBoundingClientRect();
    const dropPosition = e.clientY < rect.top + rect.height / 2;

    // Add drop marker
    const marker = document.createElement("div");
    marker.className = "drop-marker";

    if (dropPosition) {
      targetTask.parentNode.insertBefore(marker, targetTask);
    } else {
      targetTask.parentNode.insertBefore(marker, targetTask.nextSibling);
    }
  } else if (container && !targetTask) {
    // If dragging over empty space in container
    const marker = document.createElement("div");
    marker.className = "drop-marker";
    container.appendChild(marker);
  }
}

export function addTask(column) {
  window.currentColumn = column;
  window.currentTaskId = null;
  document.getElementById("modalTitle").textContent = "Add New Task";
  document.getElementById("taskInput").value = "";
  document.getElementById("taskModal").style.display = "flex";
  document.getElementById("taskInput").focus();
}

export function editTask(taskId) {
  window.currentTaskId = taskId;
  let taskEl = document.getElementById(taskId);
  let content = taskEl.querySelector(".task-content").textContent.trim();
  window.currentColumn = taskEl.closest(".column").id;

  document.getElementById("modalTitle").textContent = "Edit Task";
  document.getElementById("taskInput").value = content;
  document.getElementById("taskModal").style.display = "flex";
  document.getElementById("taskInput").focus();
}

export function closeModal() {
  document.getElementById("taskModal").style.display = "none";
  window.currentTaskId = null;
  window.currentColumn = null;
}

export function allowDrop(e) {
  e.preventDefault();
}

export let currentDraggedTask = null;
window.currentDraggedTask = null;

export let touchOffset = null;
window.touchOffset = null;

// Add this new function to handle position updates
async function updateTaskPositions(column, startIndex) {
  const columnTasks = tasks[column];
  const updates = columnTasks.map((task, index) => ({
    id: task.id,
    position: startIndex + index,
    status: column, // Ensure status is updated along with position
  }));

  try {
    const { error } = await supabase.from("tasks").upsert(updates);
    if (error) throw error;
  } catch (error) {
    console.error("Error updating positions:", error);
  }
}

// Add this function to move tasks back from completed
export async function moveBack(taskId) {
  try {
    // Find the task
    const task = tasks.completed.find((t) => t.id === taskId);
    if (!task) return;

    // Get the maximum position in the todo column
    const maxPosition = tasks.todo.reduce(
      (max, task) => Math.max(max, task.position || 0),
      -1
    );

    // Update task status to todo
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "todo",
        position: maxPosition + 1,
        completed_at: null,
      })
      .eq("id", taskId);

    if (error) throw error;

    // Reload tasks to reflect changes
    await loadTasks();
  } catch (error) {
    console.error("Error moving task back:", error);
  }
}
