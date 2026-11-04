import { useState, useEffect } from "react";
import "./App.css";

const API_URL = "https://voice-ai-backend-51uo.onrender.com/api";

function App() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [taskLoading, setTaskLoading] = useState(false);

  async function fetchTasks() {
    try {
      const result = await fetch(`${API_URL}/tasks`);
      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error || "Failed to load tasks");
      }

      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (error) {
      console.error("Fetch tasks error:", error);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  function isTaskCommand(text) {
    return /\b(create|add|save|make|remind|remember|schedule|plan)\b.*\b(task|reminder|todo|to-do)\b|\b(remind me to|don't let me forget|i need to|i have to|i must|i should|need to|have to|must|should)\b/i.test(text);
  }

  async function sendMessage(text = message) {
    if (!text.trim() || loading) return;

    setLoading(true);
    setResponse("");

    try {
      let result;
      let data;

      if (isTaskCommand(text)) {
        result = await fetch(`${API_URL}/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        });

        data = await result.json();

        if (!result.ok) {
          throw new Error(data.error || "Could not create task");
        }

        setResponse(
          `Task created successfully: ${data.task.title}. Priority: ${data.task.priority}.`
        );

        await fetchTasks();
      } else {
        result = await fetch(`${API_URL}/ask`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        });

        data = await result.json();

        if (!result.ok) {
          throw new Error(data.error || "Gemini could not respond");
        }

        setResponse(data.reply);
      }
    } catch (error) {
      console.error("Message error:", error);
      setResponse(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;

      setMessage(spokenText);
      sendMessage(spokenText);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);

      if (event.error === "not-allowed") {
        alert("Please allow microphone access.");
      } else if (event.error === "no-speech") {
        setResponse("I didn't hear anything. Please try again.");
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  }

  async function toggleTask(task) {
    if (taskLoading) return;

    setTaskLoading(true);

    try {
      const result = await fetch(`${API_URL}/tasks/${task._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          completed: !task.completed,
        }),
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error || "Could not update task");
      }

      await fetchTasks();

      setResponse(
        task.completed
          ? `Task marked as pending: ${task.title}`
          : `Task completed: ${task.title}`
      );
    } catch (error) {
      console.error("Update task error:", error);
      setResponse(error.message || "Could not update task.");
    } finally {
      setTaskLoading(false);
    }
  }

  async function deleteTask(task) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"?`
    );

    if (!confirmed || taskLoading) return;

    setTaskLoading(true);

    try {
      const result = await fetch(`${API_URL}/tasks/${task._id}`, {
        method: "DELETE",
      });

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error || "Could not delete task");
      }

      await fetchTasks();

      setResponse(`Task deleted: ${task.title}`);
    } catch (error) {
      console.error("Delete task error:", error);
      setResponse(error.message || "Could not delete task.");
    } finally {
      setTaskLoading(false);
    }
  }

  const completedTasks = tasks.filter(
    (task) => task.completed
  ).length;

  const pendingTasks = tasks.length - completedTasks;

  return (
    <div className="app">
      <header>
        <h1>Voice AI</h1>
        <p>Your personal AI-powered assistant</p>
      </header>

      <section className="chat-box">
        <h2>Talk to your assistant</h2>

        <textarea
          placeholder="Ask something or create a task..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
        />

        <div className="buttons">
          <button
            onClick={startListening}
            disabled={listening || loading}
          >
            {listening ? "Listening..." : "Speak"}
          </button>

          <button
            onClick={() => sendMessage()}
            disabled={loading || !message.trim()}
          >
            {loading ? "Thinking..." : "Send Message"}
          </button>
        </div>

        {response && (
          <div className="response">
            <h3>Assistant</h3>
            <p>{response}</p>
          </div>
        )}
      </section>

      <section className="task-section">
        <h2>My Tasks</h2>

        <div className="task-stats">
          <div className="stat-card">
            <h3>{tasks.length}</h3>
            <p>Total Tasks</p>
          </div>

          <div className="stat-card">
            <h3>{pendingTasks}</h3>
            <p>Pending</p>
          </div>

          <div className="stat-card">
            <h3>{completedTasks}</h3>
            <p>Completed</p>
          </div>
        </div>

        {tasks.length === 0 ? (
          <p className="empty-message">
            No tasks yet. Ask me to create one!
          </p>
        ) : (
          tasks.map((task) => (
            <div
              className={`task-card ${task.completed ? "completed" : ""}`}
              key={task._id}
            >
              <h3>{task.title}</h3>

              <p>{task.description}</p>

              <div className="task-details">
                <span>Priority: {task.priority}</span>

                <span>
                  Status: {task.completed ? "Completed" : "Pending"}
                </span>
              </div>

              {task.dueDate && (
                <p>
                  Due: {new Date(task.dueDate).toLocaleDateString()}
                </p>
              )}

              <div className="task-actions">
                <button
                  onClick={() => toggleTask(task)}
                  disabled={taskLoading}
                >
                  {task.completed ? "Mark Pending" : "Complete"}
                </button>

                <button
                  className="delete-button"
                  onClick={() => deleteTask(task)}
                  disabled={taskLoading}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export default App;